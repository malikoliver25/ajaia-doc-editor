# Screenshots

Captured from the live deployment (https://ajaia-doc-editor-n58h.onrender.com):

- `editor.png` — an open document with formatted text (heading, bold/italic/underline, list) and the toolbar visible
- `share-dialog.png` — the share dialog with at least one user shared (editor or viewer role shown)
- `shared-list.png` — Bob's document list showing the "Shared with me" section with role badge and owner name

Note: the free-tier database is ephemeral and re-seeds on every deploy, so the exact
documents shown here ("Q3 AI Enablement Plan") may not match what you see live at the
moment you visit — a fresh deploy shows the seeded "Welcome to Ajaia" doc owned by Alice,
plus whatever demo docs were created since. The UI itself is unchanged.

To recreate the demo state shown in these screenshots in ~30 seconds: log in as
Alice, create a document, add formatting, click Share, and add
`bob@demo.test` as an editor.
