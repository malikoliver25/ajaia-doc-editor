
const TOKEN_KEY = "ajaia_token";
const USER_KEY = "ajaia_user";

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface DocSummary {
  id: string;
  title: string;
  owner: User;
  role: "owner" | "editor" | "viewer";
  updated_at: string;
}

export interface DocFull extends DocSummary {
  content: unknown;
  created_at: string;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function token(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function storedUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  const t = token();
  if (t) headers["Authorization"] = `Bearer ${t}`;
  if (init.body && !(init.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && !path.endsWith("/auth/login")) {
    logout();
    window.location.hash = "#/login";
    throw new ApiError(401, "Session expired");
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail) && body.detail[0]?.msg) detail = body.detail[0].msg;
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function login(email: string): Promise<User> {
  const body = await request<{ token: string; user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  localStorage.setItem(TOKEN_KEY, body.token);
  localStorage.setItem(USER_KEY, JSON.stringify(body.user));
  return body.user;
}

export async function me(): Promise<User> {
  return request<User>("/api/auth/me");
}

export function doLogout(): Promise<void> {
  return request<void>("/api/auth/logout", { method: "POST" });
}

export async function listDocuments(): Promise<{ owned: DocSummary[]; shared: DocSummary[] }> {
  return request("/api/documents");
}

export async function createDocument(title?: string): Promise<DocFull> {
  return request("/api/documents", { method: "POST", body: JSON.stringify(title ? { title } : {}) });
}

export async function getDocument(id: string): Promise<DocFull> {
  return request(`/api/documents/${id}`);
}

export async function patchDocument(
  id: string,
  patch: { title?: string; content?: unknown },
): Promise<DocFull> {
  return request(`/api/documents/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteDocument(id: string): Promise<void> {
  return request<void>(`/api/documents/${id}`, { method: "DELETE" });
}

export async function importDocument(file: File): Promise<DocFull> {
  const form = new FormData();
  form.append("file", file);
  return request("/api/documents/import", { method: "POST", body: form });
}

export interface Share {
  user: User;
  role: "editor" | "viewer";
}

export async function listShares(documentId: string): Promise<Share[]> {
  return request(`/api/documents/${documentId}/shares`);
}

export async function addShare(
  documentId: string,
  email: string,
  role: "editor" | "viewer",
): Promise<Share> {
  return request(`/api/documents/${documentId}/shares`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

export async function removeShare(documentId: string, userId: number): Promise<void> {
  return request<void>(`/api/documents/${documentId}/shares/${userId}`, { method: "DELETE" });
}
