import { chromium } from "playwright";

const BASE = "https://ajaia-doc-editor-n58h.onrender.com";

async function api(page, path, method, token, body) {
  const res = await page.request.fetch(BASE + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    data: body,
  });
  return res.json();
}

async function login(page, email) {
  const { token, user } = await api(page, "/api/auth/login", "POST", null, { email });
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ([t, u]) => {
      localStorage.setItem("ajaia_token", t);
      localStorage.setItem("ajaia_user", u);
    },
    [token, JSON.stringify(user)],
  );
  return token;
}

const CONTENT = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Q3 AI Enablement Plan" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "This quarter we focus on turning AI " },
        { type: "text", marks: [{ type: "bold" }], text: "curiosity" },
        { type: "text", text: " into " },
        { type: "text", marks: [{ type: "italic" }], text: "measurable capability" },
        { type: "text", text: " across the " },
        { type: "text", marks: [{ type: "underline" }], text: "three pilot teams" },
        { type: "text", text: "." },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Key initiatives" }],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Workflow audit for the support org" }] },
          ],
        },
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Secure RAG prototype on internal docs" }] },
          ],
        },
      ],
    },
    {
      type: "orderedList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Baseline current cycle times" }] },
          ],
        },
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Ship pilot, measure, report ROI" }] },
          ],
        },
      ],
    },
  ],
};

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

// Alice: provision doc + share, then capture editor and share dialog
const alice = await ctx.newPage();
const aliceToken = await login(alice, "alice@demo.test");
const doc = await api(alice, "/api/documents", "POST", aliceToken, { title: "Q3 AI Enablement Plan" });
await api(alice, `/api/documents/${doc.id}`, "PATCH", aliceToken, { content: CONTENT });
await api(alice, `/api/documents/${doc.id}/shares`, "POST", aliceToken, {
  email: "bob@demo.test",
  role: "editor",
});

await alice.goto(BASE + `/documents/${doc.id}`, { waitUntil: "networkidle" });
await alice.waitForSelector(".ProseMirror p", { timeout: 30000 });
await alice.evaluate(() => {
  const strong = document.querySelector(".ProseMirror strong");
  const range = document.createRange();
  range.selectNodeContents(strong);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
});
await alice.waitForTimeout(400);
await alice.screenshot({ path: "../screenshots/editor.png" });
console.log("editor.png saved");

await alice.click("button:has-text('Share')");
await alice.waitForSelector(".share-dialog", { timeout: 15000 });
await alice.waitForTimeout(600);
await alice.screenshot({ path: "../screenshots/share-dialog.png" });
console.log("share-dialog.png saved");

// Bob: sees the shared section
const bob = await ctx.newPage();
await login(bob, "bob@demo.test");
await bob.goto(BASE + "/documents", { waitUntil: "networkidle" });
await bob.waitForSelector(".doc-list-section", { timeout: 30000 });
await bob.waitForTimeout(600);
await bob.screenshot({ path: "../screenshots/shared-list.png" });
console.log("shared-list.png saved");

await browser.close();
