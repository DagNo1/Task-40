import { BadRequestException, Injectable } from "@nestjs/common";
import { parse as parseCsv } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import { RawIngestionItem } from "../cleansing/cleansing.service";

@Injectable()
export class IngestionParserService {
  private readonly xmlParser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true
  });

  parseFile(filename: string, payload: Buffer, source: string): RawIngestionItem[] {
    const lower = filename.toLowerCase();
    const text = payload.toString("utf8");

    if (lower.endsWith(".json")) {
      return this.parseJson(text, source);
    }
    if (lower.endsWith(".csv")) {
      return this.parseCsv(text, source);
    }
    if (lower.endsWith(".xml")) {
      return this.parseXml(text, source);
    }

    throw new BadRequestException("Unsupported file type. Use XML, JSON, or CSV.");
  }

  parseUrlBatch(urls: string[], source: string): RawIngestionItem[] {
    return urls.map((url, index) => ({
      title: `Imported URL ${index + 1}`,
      body: "",
      url,
      source,
      sourceExternalId: `url-batch-${Date.now()}-${index}`
    }));
  }

  private parseJson(text: string, source: string): RawIngestionItem[] {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new BadRequestException("Invalid JSON file");
    }

    const items = Array.isArray(data) ? data : (data as { items?: unknown[] }).items;
    if (!items || !Array.isArray(items)) {
      throw new BadRequestException("JSON must contain an array of story objects");
    }
    return items.map((entry) => this.toItem(entry, source));
  }

  private parseCsv(text: string, source: string): RawIngestionItem[] {
    const rows = parseCsv(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Array<Record<string, string>>;
    return rows.map((row) => this.toItem(row, source));
  }

  private parseXml(text: string, source: string): RawIngestionItem[] {
    const parsed = this.xmlParser.parse(text) as Record<string, unknown>;
    const root = (parsed.feed ?? parsed.items ?? parsed) as Record<string, unknown>;
    const node = root.item ?? root.story ?? root.records ?? (Array.isArray(root) ? root : undefined);
    const records = Array.isArray(node) ? node : node ? [node] : [];

    if (!Array.isArray(records)) {
      throw new BadRequestException("XML must contain <item> or <story> nodes");
    }
    return records.map((record) => this.toItem(record, source));
  }

  private toItem(value: unknown, source: string): RawIngestionItem {
    if (!value || typeof value !== "object") {
      throw new BadRequestException("Ingestion row must be an object");
    }
    const row = value as Record<string, unknown>;
    return {
      title: String(row.title ?? row.headline ?? ""),
      body: String(row.body ?? row.content ?? row.summary ?? ""),
      url: String(row.url ?? row.link ?? ""),
      source: String(row.source ?? source),
      sourceExternalId: row.externalId ? String(row.externalId) : undefined,
      publishedAt: row.publishedAt ? String(row.publishedAt) : undefined
    };
  }
}
