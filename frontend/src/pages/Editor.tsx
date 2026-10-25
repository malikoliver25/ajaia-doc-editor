import { useCallback, useEffect, useRef, useState } from "react";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError, deleteDocument, getDocument, patchDocument } from "../api";
import { addShare, listShares, removeShare } from "../api";
import type { DocFull, Share } from "../api";
import { useLogout } from "./Documents";

type SaveState = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 800;

interface TiptapDoc {
  type: "doc";
  content: unknown[];
}

function isTiptapDoc(value: unknown): value is TiptapDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type: unknown }).type === "doc" &&
    "content" in value &&
    Array.isArray((value as { content: unknown }).content)
  );
}

function parseContent(raw: unknown): { doc: TiptapDoc | null; error: string | null } {
  // API returns the Tiptap doc as a JSON object (or a JSON string).
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { doc: null, error: "Document content is corrupted (invalid JSON)." };
    }
  }
  if (isTiptapDoc(parsed)) return { doc: parsed, error: null };
  return { doc: null, error: "Document content has an invalid shape." };
}

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const doLogout = useLogout();

  const [doc, setDoc] = useState<DocFull | null>(null);
  const [loadError, setLoadError] = useState<number | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [titleError, setTitleError] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [banner, setBanner] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shares, setShares] = useState<Share[] | null>(null);
  const [shareFormEmail, setShareFormEmail] = useState("");
  const [shareFormRole, setShareFormRole] = useState<"editor" | "viewer">("editor");
  const [shareError, setShareError] = useState("");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContent = useRef<object | null>(null);
  const docRef = useRef<DocFull | null>(null);
  docRef.current = doc;

  const flush = useCallback(async () => {
    const content = pendingContent.current;
    const current = docRef.current;
    if (!content || !current) return;
    pendingContent.current = null;
    setSaveState("saving");
    try {
      await patchDocument(current.id, { content });
      setSaveState("saved");
    } catch (e) {
      pendingContent.current = content; // keep for retry
      setSaveState("error");
      if (!(e instanceof ApiError && e.status === 401)) {
        setBanner(e instanceof ApiError ? e.message : "Save failed");
      }
    }
  }, []);

  const editor = useEditor({
    extensions: [StarterKit],
    content: { type: "doc", content: [] },
    editable: false,
    onUpdate: ({ editor }) => {
      pendingContent.current = editor.getJSON();
      setSaveState("idle");
      clearTimeout(timer.current!);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
  });

  useEffect(() => {
    let cancelled = false;
    getDocument(id!)
      .then((d) => {
        if (cancelled) return;
        const { doc: parsed, error } = parseContent(d.content);
        if (error) {
          setParseError(error);
          return;
        }
        setDoc(d);
        setTitle(d.title);
        if (editor) {
          editor.commands.setContent(JSON.parse(JSON.stringify(parsed)) as never, {
            emitUpdate: false,
          });
          editor.setEditable(d.role !== "viewer");
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof ApiError ? e.status : 0);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, editor]);

  // flush pending content on unmount / beforeunload
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingContent.current) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      clearTimeout(timer.current!);
      if (pendingContent.current) void flush();
    };
  }, [flush]);

  const canEdit = doc?.role === "owner" || doc?.role === "editor";

  async function saveTitle() {
    if (!doc) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("Title cannot be empty.");
      return;
    }
    setTitleError("");
    try {
      const updated = await patchDocument(doc.id, { title: trimmed });
      setDoc(updated);
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : "Rename failed");
    }
  }

  async function onDelete() {
    if (!doc) return;
    if (!window.confirm(`Delete "${doc.title}"? This cannot be undone.`)) return;
    try {
      await deleteDocument(doc.id);
      navigate("/documents");
    } catch (e) {
      setBanner(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  async function openShareDialog() {
    setShareOpen(true);
    setShareError("");
    if (!doc) return;
    try {
      setShares(await listShares(doc.id));
    } catch (e) {
      setShares([]);
      setShareError(e instanceof ApiError ? e.message : "Failed to load shares");
    }
  }

  async function onAddShare() {
    if (!doc) return;
    setShareError("");
    try {
      await addShare(doc.id, shareFormEmail.trim().toLowerCase(), shareFormRole);
      setShares(await listShares(doc.id));
      setShareFormEmail("");
    } catch (e) {
      setShareError(e instanceof ApiError ? e.message : "Failed to add share");
    }
  }

  async function onRoleChange(email: string, role: "editor" | "viewer") {
    if (!doc) return;
    setShareError("");
    try {
      await addShare(doc.id, email, role); // upsert: updates role for existing share
      setShares(await listShares(doc.id));
    } catch (e) {
      setShareError(e instanceof ApiError ? e.message : "Failed to update role");
    }
  }

  async function onRemoveShare(userId: number) {
    if (!doc) return;
    setShareError("");
    try {
      await removeShare(doc.id, userId);
      setShares(await listShares(doc.id));
    } catch (e) {
      setShareError(e instanceof ApiError ? e.message : "Failed to remove share");
    }
  }

  if (loadError === 404) {
    return (
      <div className="not-found">
        <h1>Document not found or you don't have access</h1>
        <button onClick={() => navigate("/documents")}>Back to documents</button>
      </div>
    );
  }
  if (loadError !== null) {
    return (
      <div className="not-found">
        <h1>Failed to load document</h1>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }
  if (parseError) {
    return (
      <div className="not-found">
        <h1>{parseError}</h1>
        <button onClick={() => navigate("/documents")}>Back to documents</button>
      </div>
    );
  }
  if (!doc || !editor) {
    return <div className="page">Loading…</div>;
  }

  return (
    <div className="editor-page">
      {banner && (
        <div className="banner">
          <span>{banner}</span>
          <button onClick={() => setBanner("")}>Dismiss</button>
        </div>
      )}
      {titleError && <p className="error-text">{titleError}</p>}
      <div className="title-row">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), void saveTitle())}
          disabled={!canEdit}
          aria-label="Document title"
        />
        <span
          className={`save-status ${saveState}`}
          onClick={() => saveState === "error" && void flush()}
        >
          {saveState === "saving" && "Saving…"}
          {saveState === "saved" && "Saved"}
          {saveState === "error" && "Save failed — click to retry"}
          {saveState === "idle" && ""}
        </span>
        {doc.role === "viewer" && <span className="save-status">Read-only (viewer)</span>}
        {doc.role === "owner" && <button onClick={() => void openShareDialog()}>Share</button>}
      </div>

      {shareOpen && doc.role === "owner" && (
        <div className="share-dialog">
          <h3>Share this document</h3>
          {shareError && <p className="error-text">{shareError}</p>}
          <ul className="share-list">
            {(shares ?? []).map((s) => (
              <li key={s.user.id}>
                <span>
                  {s.user.name} ({s.user.email})
                </span>
                <select
                  value={s.role}
                  onChange={(e) => void onRoleChange(s.user.email, e.target.value as "editor" | "viewer")}
                >
                  <option value="editor">editor</option>
                  <option value="viewer">viewer</option>
                </select>
                <button className="danger" onClick={() => void onRemoveShare(s.user.id)}>
                  Remove
                </button>
              </li>
            ))}
            {shares !== null && shares.length === 0 && (
              <li className="empty-state">Not shared with anyone yet.</li>
            )}
          </ul>
          <form
            className="share-form"
            onSubmit={(e) => {
              e.preventDefault();
              void onAddShare();
            }}
          >
            <input
              type="email"
              placeholder="email (seeded users only)"
              value={shareFormEmail}
              onChange={(e) => setShareFormEmail(e.target.value)}
            />
            <select
              value={shareFormRole}
              onChange={(e) => setShareFormRole(e.target.value as "editor" | "viewer")}
            >
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
            <button className="primary" type="submit" disabled={!shareFormEmail.trim()}>
              Add / Update
            </button>
          </form>
          <p className="hint-inline">Changes apply immediately. Removing a share revokes access.</p>
          <button onClick={() => setShareOpen(false)}>Close</button>
        </div>
      )}

      {canEdit && (
        <div className="toolbar">
          <ToolbarButton label="B" title="Bold" isActive={() => editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} editor={editor} />
          <ToolbarButton label="I" title="Italic" isActive={() => editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} editor={editor} />
          <ToolbarButton label="U" title="Underline" isActive={() => editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} editor={editor} />
          <ToolbarButton label="H1" isActive={() => editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} editor={editor} />
          <ToolbarButton label="H2" isActive={() => editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} editor={editor} />
          <ToolbarButton label="H3" isActive={() => editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} editor={editor} />
          <ToolbarButton label="¶" title="Paragraph" isActive={() => editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()} editor={editor} />
          <ToolbarButton label="• List" isActive={() => editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} editor={editor} />
          <ToolbarButton label="1. List" isActive={() => editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} editor={editor} />
          <ToolbarButton label="↺" title="Undo" isActive={() => false} onClick={() => editor.chain().focus().undo().run()} editor={editor} />
          <ToolbarButton label="↻" title="Redo" isActive={() => false} onClick={() => editor.chain().focus().redo().run()} editor={editor} />
        </div>
      )}

      <div className="doc-meta">
        Owner: {doc.owner.name} · Your role: {doc.role}
      </div>
      <EditorContent editor={editor} className="tiptap" />
      {doc.role === "owner" && (
        <div style={{ marginTop: 16 }}>
          <button className="danger" onClick={onDelete}>Delete document</button>
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <button onClick={doLogout}>Log out</button>
      </div>
    </div>
  );
}

function ToolbarButton({
  editor,
  label,
  title,
  isActive,
  onClick,
}: {
  editor: Editor;
  label: string;
  title?: string;
  isActive: () => boolean;
  onClick: () => void;
}) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const update = () => setActive(isActive());
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    update();
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor, isActive]);
  return (
    <button
      className={active ? "active" : ""}
      title={title ?? label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
