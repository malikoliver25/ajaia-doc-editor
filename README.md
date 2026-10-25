# Ajaia Doc Editor

A lightweight collaborative document editor inspired by Google Docs. Users create rich-text documents, import `.txt`/`.md` files, and share documents with other users as editors or viewers — all persisted in SQLite with role-based access enforced server-side.

**Live URL:** [LIVE_URL]

## What it does

Log in as a seeded demo user, create and edit rich-text documents (bold, italic, underline, headings, bullet/ordered lists) with debounced autosave, import plain-text or Markdown files as new documents, and share any document you own with other users as an editor or viewer. Editors can edit; viewers get a read-only editor; the document list splits "My documents" from "Shared with me".

## Seeded test accounts

Login is mocked by email — click a name on the login page or type a seeded email. No passwords.

| Email | Name | Notes |
|---|---|---|
| alice@demo.test | Alice | Owns the sample "Welcome to Ajaia" doc |
| bob@demo.test | Bob | |
| carol@demo.test | Carol | |

## Local setup

Prerequisites: Python 3.11+, Node 20+ (Docker optional).

**Backend** (FastAPI + SQLite):

```bash
cd backend
python3.11 -m venv .venv
.venv/bin/pip install -r requirements.txt        # app deps (tests need pytest, httpx)
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload           # serves API on :8000, seeds DB on startup
```

**Frontend** (Vite + React + TypeScript + Tiptap):

```bash
cd frontend
npm ci
npm run dev        # dev server on :5173, proxies /api to :8000
```

Open http://localhost:5173.

**Tests:**

```bash
cd backend  && .venv/bin/python -m pytest -q        # 30 tests (auth, access, docs, shares, import, static)
cd frontend && npm test                            # 2 Vitest + RTL tests (save-status, list sections)
cd frontend && npm run build                       # production build (served by backend when dist/ exists)
```

## Docker (single container)

One image serves the API and the built frontend from the same origin:

```bash
docker build -t ajaia-doc-editor .
docker run -p 8000:8000 ajaia-doc-editor
# open http://localhost:8000
```

## File import

Supported types: `.txt` and `.md` only, max **1 MB**, must be UTF-8 (stated in the UI next to the Import button). Conversion happens server-side in `backend/app/services/convert.py`:

- `.txt`: every non-empty line becomes a Tiptap paragraph
- `.md`: additionally, `#`/`##`/`###` lines become headings 1–3; consecutive `- `/`* ` lines are grouped into a bullet list

## Known limitations

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full prioritization/tradeoff notes. Headlines: mocked email login with no expiry, last-write-wins autosave (no conflict handling), no pagination, and on free-tier hosting the SQLite disk is ephemeral (DB re-seeds on boot).

Note on the live demo: free-tier web services sleep after ~15 minutes idle and take 1–2 minutes to wake on the first request — a slow first load is the platform waking up, not a broken deploy.
