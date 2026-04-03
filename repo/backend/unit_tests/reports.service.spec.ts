import { ReportsService } from "../src/modules/reports/reports.service";

describe("ReportsService", () => {
  it("formats audit rows as CSV", () => {
    const service = new ReportsService(
      {} as any,
      { getOrLoad: jest.fn((_key, loader) => loader()) } as any
    );
    const csv = service.toCsv([
      {
        id: "a1",
        createdAt: "2026-03-28T00:00:00.000Z",
        userId: "u1",
        actionType: "MERGE_APPLIED",
        entityType: "story",
        entityId: "s1",
        notes: "note"
      }
    ]);
    expect(csv).toContain("MERGE_APPLIED");
    expect(csv.split("\n").length).toBe(2);
  });
});
