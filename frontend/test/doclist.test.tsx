import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { DocumentList } from "../src/pages/Documents";
import { listDocuments } from "../src/api";

vi.mock("../src/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api")>();
  return {
    ...actual,
    listDocuments: vi.fn(),
  };
});

const alice = { id: 1, email: "alice@demo.test", name: "Alice" };
const bob = { id: 2, email: "bob@demo.test", name: "Bob" };

describe("DocumentList owned vs shared sections", () => {
  beforeEach(() => {
    vi.mocked(listDocuments).mockResolvedValue({
      owned: [
        {
          id: "d1",
          title: "My own doc",
          owner: alice,
          role: "owner" as const,
          updated_at: "2026-01-01T00:00:00",
        },
      ],
      shared: [
        {
          id: "d2",
          title: "Shared to me",
          owner: bob,
          role: "editor" as const,
          updated_at: "2026-01-01T00:00:00",
        },
      ],
    });
  });

  it("renders owned docs under My documents and shared docs under Shared with me", async () => {
    render(
      <MemoryRouter>
        <DocumentList />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("My own doc")).toBeTruthy());

    const owned = screen.getByText("My documents").closest("div")!;
    const shared = screen.getByText("Shared with me").closest("div")!;
    expect(owned).toBeTruthy();
    expect(shared).toBeTruthy();

    // each doc lives inside its own section (containment, not just order)
    expect(owned).toContainElement(screen.getByText("My own doc"));
    expect(shared).toContainElement(screen.getByText("Shared to me"));
    expect(owned).not.toContainElement(screen.getByText("Shared to me"));
    expect(shared).not.toContainElement(screen.getByText("My own doc"));

    // shared row shows role badge and owner name
    expect(screen.getByText("editor")).toBeTruthy();
    expect(screen.getByText("from Bob")).toBeTruthy();
  });
});
