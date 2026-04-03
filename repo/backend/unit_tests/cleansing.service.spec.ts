import { CleansingService } from "../src/modules/cleansing/cleansing.service";

describe("CleansingService", () => {
  it("normalizes URL variants and strips tracking params", () => {
    const service = new CleansingService({} as any);
    const normalized = service.normalizeUrl("EXAMPLE.com/news?id=1&utm_source=test#section");
    expect(normalized).toBe("https://example.com/news?id=1");
  });

  it("creates cleansing events for whitespace and URL fixes", () => {
    const service = new CleansingService({} as any);
    const result = service.cleanse(
      {
        title: " Hello   World ",
        body: "Body   with   spacing",
        url: "example.com/path/"
      },
      "feed"
    );
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.item.canonicalUrl).toBe("https://example.com/path");
  });
});
