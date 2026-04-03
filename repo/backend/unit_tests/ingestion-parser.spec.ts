import { IngestionParserService } from "../src/modules/ingestion/ingestion-parser.service";

describe("IngestionParserService", () => {
  const parser = new IngestionParserService();

  it("parses JSON arrays", () => {
    const rows = parser.parseFile(
      "feed.json",
      Buffer.from('[{"title":"A","body":"B","url":"https://x.local/1"}]'),
      "json-source"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe("json-source");
  });

  it("parses CSV rows", () => {
    const rows = parser.parseFile(
      "feed.csv",
      Buffer.from("title,body,url\nA,B,https://x.local/1\n"),
      "csv-source"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("A");
  });

  it("parses XML records", () => {
    const xml = `<feed><item><title>A</title><body>B</body><url>https://x.local/1</url></item></feed>`;
    const rows = parser.parseFile("feed.xml", Buffer.from(xml), "xml-source");
    expect(rows).toHaveLength(1);
    expect(rows[0].url).toBe("https://x.local/1");
  });
});
