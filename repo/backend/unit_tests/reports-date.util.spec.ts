import { BadRequestException } from "@nestjs/common";
import { parseDateRangeStrict } from "../src/api/reports-date.util";

describe("parseDateRangeStrict", () => {
  it("returns undefined for omitted values", () => {
    expect(parseDateRangeStrict(undefined)).toBeUndefined();
  });

  it("parses valid MM/DD/YYYY date", () => {
    const parsed = parseDateRangeStrict("03/28/2026");
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(2);
    expect(parsed?.getDate()).toBe(28);
  });

  it("rejects malformed dates", () => {
    expect(() => parseDateRangeStrict("2026-03-28")).toThrow(BadRequestException);
    expect(() => parseDateRangeStrict("13/01/2026")).toThrow(BadRequestException);
    expect(() => parseDateRangeStrict("02/30/2026")).toThrow(BadRequestException);
  });
});
