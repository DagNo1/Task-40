import { describe, expect, it } from "vitest";
import { encodeForHtml } from "../../src/utils/encoding";

describe("encodeForHtml", () => {
  it("escapes HTML-sensitive characters", () => {
    expect(encodeForHtml("<script>alert('x')</script>")).toContain("&lt;script&gt;");
  });
});
