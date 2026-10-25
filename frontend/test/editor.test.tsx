import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import EditorPage from "../src/pages/Editor";
import { BrowserRouter } from "react-router-dom";
import { getDocument, patchDocument } from "../src/api";

vi.mock("../src/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api")>();
  return {
    ...actual,
    getDocument: vi.fn(),
    patchDocument: vi.fn(),
  };
});

const doc = {
  id: "d1",
  title: "Test doc",
  owner: { id: 1, email: "alice@demo.test", name: "Alice" },
  role: "owner" as const,
  created_at: "2026-01-01T00:00:00",
  updated_at: "2026-01-01T00:00:00",
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }],
  },
};

function renderEditor() {
  return render(
    <BrowserRouter>
      <EditorPage />
    </BrowserRouter>,
  );
}

describe("EditorPage save-status state machine", () => {
  beforeEach(() => {
    vi.mocked(getDocument).mockResolvedValue(doc);
    vi.mocked(patchDocument).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return doc;
    });
  });

  it("shows Saving… then Saved as the debounced PATCH round-trips", async () => {
    renderEditor();
    await screen.findByDisplayValue("Test doc");
    await waitFor(() =>
      expect(document.querySelector(".tiptap[contenteditable=true]")).toBeTruthy(),
    );

    await userEvent.type(document.querySelector(".tiptap")!, "!");

    // debounce (800ms) elapses -> PATCH in flight -> "Saving…"
    await waitFor(() => expect(screen.getByText("Saving…")).toBeTruthy(), { timeout: 3000 });
    // mock resolves -> "Saved"
    await waitFor(() => expect(screen.getByText("Saved")).toBeTruthy(), { timeout: 3000 });
    expect(patchDocument).toHaveBeenCalledWith(
      "d1",
      expect.objectContaining({ content: expect.anything() }),
    );
  });
});
