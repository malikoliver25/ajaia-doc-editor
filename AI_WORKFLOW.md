# AI Workflow Note

## Tools used, and for what

- **Coding agent (Claude via omp harness):** full-stack implementation across all phases — backend models/routers/tests, React+Tiptap frontend, Docker packaging, docs. I authored the phase specs, reviewed every diff, and made the accept/reject calls.
- **Agent tooling:** pytest/Vitest runs, uvicorn and Vite smoke runs, real-browser (Chrome DevTools MCP) end-to-end verification of login → edit → share → role-downgrade → revoke, Docker build/run.

## Where AI materially sped things up

- **Test-first backend in one pass:** 27 pytest tests covering auth/access/documents/shares/import written alongside the implementation; the access matrix (404 vs 403) was encoded as tests immediately, which is usually the slowest part to get right.
- **Tiptap integration:** editor wiring (autosave state machine, toolbar active states, read-only role handling) landed working on the first build; hand-doing ProseMirror integration typically costs hours.
- **Browser-driven verification:** scripting the six-step sharing flow (import → share → edit-as-Bob → downgrade to viewer → revoke → 404) took minutes and caught nothing broken because tests had run first.

## AI output I changed or rejected (concrete cases)

1. **`EmailStr` rejected the spec's own domain.** The agent-generated schema used pydantic `EmailStr`; `email-validator` refuses `@demo.test` (reserved TLD), so every login 401'd. Rejected the AI's validation layer for plain `str` — with only three seeded emails, format validation is dead code.
2. **A scrambled `imports.py` after an edit.** An agent edit left duplicated imports and a broken function signature. Instead of stacking corrective patches (which twice made adjacent-line mistakes in a test file), I rewrote the whole file from scratch — faster and safer.
3. **Wrong test expectation for share denial.** The agent's test asserted an editor attempting to share gets 404; `access.py` deliberately returns 403 for readers (no existence leak only for strangers). Fixed the test to match the documented policy — editor → 403, stranger → 404 — rather than weakening the access module.
4. **Missing flush in `seed.py` (real bug the agent caught by running tests).** New seeded users weren't flushed, so the sample document insert had `owner_id=NULL` and crashed. The failing test run surfaced it; one-line fix (`db.flush()` after adding a new user).

## How correctness was verified

- **Backend:** 30 pytest tests (fresh temp SQLite DB per session) — auth, access matrix, document CRUD/validation, share upsert/remove, import conversion + limits, static serving.
- **Frontend:** 2 Vitest + React Testing Library tests (autosave state machine through real timers; owned/shared list sectioning), `tsc` clean, production build clean.
- **End-to-end:** real-browser smoke of the full sharing flow against the dev stack, then the same core flow (login → create → share) against the Docker container, single origin.
- **Deploy:** Render blueprint from the Dockerfile; live URL smoke-tested after first deploy.

## Honest limits

- Not reviewed line by line: Tiptap/ProseMirror internals, generated `package-lock.json`, the Vite scaffold.
- Not verified: behavior under concurrent editors (last-write-wins is known-clobber), files near exactly 1 MB on slow connections, Safari specifics.
- The doc-list page renders all documents per request (fine at demo scale, O(all docs)).

## [PERSONAL REVIEW]

*(To be filled in by the engineer: your own judgment on the build, anything you changed by hand, and where you disagree with the choices above.)*
