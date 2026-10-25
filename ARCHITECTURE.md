# Architecture

## Components

- **Frontend:** React 19 + TypeScript (Vite), Tiptap 3 rich-text editor, react-router. Plain CSS themed to Ajaia brand tokens (navy `#001d6b`, sky `#97c2f8`, Poppins). No UI component library.
- **Backend:** FastAPI (Python 3.11), SQLAlchemy 2.0 ORM, SQLite file at `./data/app.db` (`DATABASE_URL` env var to override). Serves the built frontend via `StaticFiles` + SPA fallback, so production is one deployable unit.
- **Storage:** single SQLite DB; content stored as a Tiptap JSON string (`{"type":"doc","content":[...]}`), max 1 MB enforced server-side.

## Data model

- **User** — id, unique email, name
- **Session** — opaque bearer token (pk), user_id, created_at; no expiry
- **Document** — uuid pk, owner_id, title (1–200 chars), content (Tiptap JSON string), timestamps
- **DocumentShare** — document_id + user_id UNIQUE, role `editor | viewer`

Seeding (idempotent, runs on startup): Alice/Bob/Carol users + one sample doc owned by Alice.

## Access control

All logic lives in `backend/app/access.py` — one module, no ad-hoc owner checks in routers:

- `get_role(db, doc, user)` → `"owner" | "editor" | "viewer" | None`
- `require_read / require_write / require_owner` wrap it; routers only call these

Policy: **no access → 404** (never leak existence with a 403), **read-access but insufficient role → 403**. So a stranger gets 404 on GET/PATCH/DELETE and share management; an editor gets 403 on DELETE and share management. Viewers get 403 on PATCH.

## What was prioritized, and why

- **Rich-text fidelity via Tiptap** — formatting is the core of a doc editor; a proven schema (ProseMirror) beats hand-rolled HTML plumbing.
- **Centralized access rules** — sharing is where reviewers probe; one module makes the 404/403 policy auditable and testable (5 dedicated pytest files, 30 backend tests).
- **Tested import converter** — `.md`/`.txt` → Tiptap nodes is a pure function with unit tests for headings, bullet grouping, and edge cases.
- **One deployable unit** — FastAPI serves the SPA; single Docker image, no CORS or multi-host complexity in production.

## What was deprioritized, and why

Real auth (passwords/OAuth), real-time collaboration (websockets/CRDT), version history, comments, PDF export, pagination. Each adds surface area out of proportion to the 4–6 h scope; the mocked login and last-write-wins model are the deliberate scope cuts that made depth possible in editing, sharing, and import.

## Tradeoffs

- **SQLite on ephemeral disk (Render free tier):** DB re-seeds on every boot; fine for a demo, unacceptable for prod — swap `DATABASE_URL` to Postgres and everything else stays identical.
- **Last-write-wins autosave:** debounced 800 ms PATCH with no conflict detection; two concurrent editors can clobber each other.
- **Mocked login, no session expiry:** tokens live until logout; acceptable because accounts are seeded demo fixtures.

## Next 2–4 hours

1. Version history (cheap on current schema: copy-on-write `DocumentRevision` table)
2. Conflict-aware saves (updatedAt precondition → 409 + merge prompt)
3. Real auth (password hashing or OAuth) + session expiry
4. Markdown export to complement import
