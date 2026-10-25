# Submission

**Live URL:** https://ajaia-doc-editor-n58h.onrender.com — log in by clicking Alice, Bob, or Carol (or typing `alice@demo.test` / `bob@demo.test` / `carol@demo.test`; mocked email login, no passwords).

**Walkthrough video:** skipped (per time constraint). The screenshots below plus this document cover the same ground.

## What's in the folder

| Item | Path |
|---|---|
| Source code (backend + frontend + Docker + deploy config) | this repo — see repo structure below |
| README with local setup/run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| This file | `SUBMISSION.md` |
| Screenshots | `screenshots/` |
| Test accounts | Alice/Bob/Carol (see README) — Alice owns the sample doc |
| render.yaml (how the live URL is deployed) | `render.yaml` |
| Dockerfile (single-container deploy) | `Dockerfile` |

## What works end to end

- Email login for the three seeded users; session restore; logout
- Create / rename / edit / delete documents
- Rich text: bold, italic, underline, H1–H3, paragraph, bullet & ordered lists, undo/redo, active-state toolbar
- Debounced autosave (800 ms) with Saving…/Saved/Save-failed-retry status; persists across refresh
- Import `.txt`/`.md` (≤1 MB, UTF-8) with Markdown → heading/bullet/paragraph conversion; clear errors for other types/oversizes/bad encoding
- Sharing: owner-only dialog, add/update/remove, editor vs viewer roles
- Owned vs shared list sections with role badges and owner names; empty states
- Access enforcement: viewers read-only (toolbar hidden), editors can't delete/share, strangers get 404
- Single Docker image serving API + SPA on one origin, deployed to Render (free tier) at the live URL above

## Tests

- Backend: 30 pytest tests, all passing
- Frontend: 2 Vitest+RTL tests, passing; `tsc` and production build clean

## Intentional scope cuts

Real authentication, real-time co-editing, version history, comments, PDF export, pagination. Rationale and tradeoffs in `ARCHITECTURE.md`.

## Known limitations

- Render free tier: SQLite on ephemeral disk — data resets on redeploy/restart (re-seeds automatically). Acceptable for a demo.
- Last-write-wins autosave; concurrent editors can clobber.
- Login is mocked (seeded emails only); sessions don't expire.

## With another 2–4 hours

Version history, conflict-aware saves (updatedAt precondition), real auth, Markdown export — in that order.
