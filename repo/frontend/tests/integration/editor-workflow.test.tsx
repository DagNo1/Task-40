// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorQueuePage } from "../../src/modules/editor-queue/editor-queue-page";
import { IngestionPage } from "../../src/modules/ingestion/ingestion-page";

const mocks = vi.hoisted(() => ({
  authState: {
    csrfToken: "csrf-token",
    session: { userId: "u1", permissions: ["stories.review"], roles: ["editor"] }
  },
  editorApi: {
    fetchEditorQueue: vi.fn(),
    fetchStoryDiff: vi.fn(),
    submitMerge: vi.fn(),
    submitRepair: vi.fn()
  },
  ingestionApi: {
    uploadIngestionFile: vi.fn(),
    submitUrlBatch: vi.fn()
  }
}));

vi.mock("../../src/app/providers/auth-provider", () => ({
  useAuth: () => mocks.authState
}));

vi.mock("../../src/modules/editor-queue/editor-queue.api", () => mocks.editorApi);
vi.mock("../../src/modules/ingestion/ingestion.api", () => mocks.ingestionApi);

describe("Editor workflow integration", () => {
  beforeEach(() => {
    mocks.editorApi.fetchEditorQueue.mockReset();
    mocks.editorApi.fetchStoryDiff.mockReset();
    mocks.editorApi.submitMerge.mockReset();
    mocks.editorApi.submitRepair.mockReset();
    mocks.ingestionApi.uploadIngestionFile.mockReset();
    mocks.ingestionApi.submitUrlBatch.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("supports ingestion URL batch submission and success response", async () => {
    mocks.ingestionApi.submitUrlBatch.mockResolvedValue({
      accepted: 2,
      rejected: 0,
      duplicates: 0,
      anomalies: 0,
      thresholds: { simhashMaxHamming: 8, minhashMinSimilarity: 0.82 }
    });

    render(<IngestionPage />);

    const textareas = screen.getAllByRole("textbox");
    fireEvent.change(textareas[textareas.length - 1], {
      target: { value: "https://example.com/a\nhttps://example.com/b" }
    });

    fireEvent.click(screen.getByText("Submit URL Batch"));

    expect(await screen.findByText("Submitted 2 URLs for ingestion.")).toBeTruthy();
    expect(mocks.ingestionApi.submitUrlBatch).toHaveBeenCalledWith(
      {
        source: "wire",
        urls: ["https://example.com/a", "https://example.com/b"]
      },
      "csrf-token"
    );
  });

  it("requires mandatory notes before merge/repair actions can execute", async () => {
    mocks.editorApi.fetchEditorQueue.mockResolvedValue([
      {
        queueId: "q1",
        storyId: "s1",
        versionId: "v1",
        versionNumber: 3,
        normalizedUrl: "https://example.com/story",
        title: "Story 1",
        nearDuplicate: true,
        suspiciousAnomaly: false,
        mergeTargets: [{ storyId: "target-1", title: "Target", canonicalUrl: "https://example.com/target", confidence: 0.9 }],
        createdAt: "2026-03-30T00:00:00.000Z"
      }
    ]);
    mocks.editorApi.fetchStoryDiff.mockResolvedValue([]);
    mocks.editorApi.submitMerge.mockResolvedValue(undefined);
    mocks.editorApi.submitRepair.mockResolvedValue(undefined);

    render(<EditorQueuePage />);

    expect(await screen.findByText("Selected Item")).toBeTruthy();

    const acceptMerge = screen.getByRole("button", { name: "Accept Merge" }) as HTMLButtonElement;
    const runRepair = screen.getByRole("button", { name: "Run Repair" }) as HTMLButtonElement;
    expect(acceptMerge.disabled).toBe(true);
    expect(runRepair.disabled).toBe(true);

    const noteAreas = screen.getAllByRole("textbox");
    fireEvent.change(noteAreas[0], { target: { value: "valid note for merge" } });
    fireEvent.change(noteAreas[1], { target: { value: "valid note for repair" } });

    expect((screen.getByRole("button", { name: "Accept Merge" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Run Repair" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
