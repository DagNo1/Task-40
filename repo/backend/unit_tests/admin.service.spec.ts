import { BadRequestException } from "@nestjs/common";
import { AdminService } from "../src/modules/admin/admin.service";

describe("AdminService", () => {
  it("rejects unsupported threshold keys", async () => {
    const service = new AdminService(
      {
        systemThresholdConfig: { upsert: jest.fn() }
      } as any,
      { write: jest.fn() } as any,
      { upsertPerUserLimit: jest.fn() } as any
    );

    await expect(
      service.setThreshold("u1", "UNSUPPORTED_KEY", {
        value: "100",
        changeNote: "set threshold"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
