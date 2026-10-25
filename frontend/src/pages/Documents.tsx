import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, createDocument, doLogout, listDocuments, logout } from "../api";
import type { DocSummary, User } from "../api";

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
      </div>
      {docs ? (
        <>
          {section("Owned", docs.owned)}
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
