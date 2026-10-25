import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ApiError,
  createDocument,
  doLogout,
  importDocument,
  listDocuments,
  logout,
} from "../api";
import type { DocSummary, User } from "../api";

const MAX_IMPORT_BYTES = 1_000_000;
const ALLOWED_EXTENSIONS = [".txt", ".md"];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function useLogout() {
  const navigate = useNavigate();
  return async () => {
    try {
      await doLogout();
    } catch {
      /* token already invalid is fine */
    }
    logout();
    navigate("/login");
  };
}

export function DocumentList() {
  const [docs, setDocs] = useState<{ owned: DocSummary[]; shared: DocSummary[] } | null>(null);
  const [error, setError] = useState("");
  const [importError, setImportError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    listDocuments()
      .then(setDocs)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load documents"));
  }, []);

  async function onNew() {
    const doc = await createDocument();
    navigate(`/documents/${doc.id}`);
  }

  async function onImport(file: File | undefined) {
    setImportError("");
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setImportError(`Unsupported file type; allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setImportError("File exceeds the 1 MB limit");
      return;
    }
    try {
      const doc = await importDocument(file);
      navigate(`/documents/${doc.id}`);
    } catch (e) {
      setImportError(e instanceof ApiError ? e.message : "Import failed");
    }
  }

  function section(label: string, items: DocSummary[]) {
    return (
      <div className="doc-list-section">
        <h2>{label}</h2>
        {items.length === 0 ? (
          <p className="empty-state">No documents yet.</p>
        ) : (
          items.map((d) => (
            <div key={d.id} className="doc-row">
              <Link to={`/documents/${d.id}`}>{d.title}</Link>
              {d.role !== "owner" && <span className="owner-name">from {d.owner.name}</span>}
              <span className="role-badge">{d.role}</span>
              <span className="updated">{fmtDate(d.updated_at)}</span>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="page">
      {error && (
        <div className="banner">
          <span>{error}</span>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      <div className="list-actions">
        <button className="primary" onClick={onNew}>
          New document
        </button>
        <button onClick={() => fileInput.current?.click()}>Import file</button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.md"
          style={{ display: "none" }}
          onChange={(e) => {
            void onImport(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <span className="hint-inline">.txt / .md, up to 1 MB</span>
      </div>
      {importError && (
        <div className="banner">
          <span>{importError}</span>
          <button onClick={() => setImportError("")}>Dismiss</button>
        </div>
      )}
      {docs ? (
        <>
          {section("My documents", docs.owned)}
          {section("Shared with me", docs.shared)}
        </>
      ) : (
        !error && <p className="empty-state">Loading…</p>
      )}
    </div>
  );
}

export function Header({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  return (
    <header className="app-header">
      <span className="brand">Ajaia</span>
      <span className="spacer" />
      {user && <span className="who">{user.name}</span>}
      {user && <button onClick={onLogout}>Log out</button>}
    </header>
  );
}
