import { Injectable } from "@nestjs/common";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

export interface RawIngestionItem {
  title?: string;
  body?: string;
  url?: string;
  source?: string;
  sourceExternalId?: string;
  publishedAt?: string | null;
}

export interface CleansedItem {
  title: string;
  body: string;
  rawUrl: string;
  canonicalUrl: string;
  source: string;
  sourceExternalId?: string;
  publishedAt?: Date;
  anomalies: string[];
  contentHash: string;
}

interface CleansingEventDraft {
  action: string;
  field: string;
  beforeValue?: string;
  afterValue?: string;
  metadata?: InputJsonValue;
}

@Injectable()
export class CleansingService {
  constructor(private readonly prisma: PrismaService) {}

  cleanse(item: RawIngestionItem, defaultSource: string): { item: CleansedItem; events: CleansingEventDraft[] } {
    const events: CleansingEventDraft[] = [];
    const title = (item.title ?? "").trim();
    const body = (item.body ?? "").trim();
    const source = (item.source ?? defaultSource).trim() || "unknown";
    const rawUrl = (item.url ?? "").trim();

    const cleanedTitle = title.replace(/\s+/g, " ");
    if (cleanedTitle !== title) {
      events.push({
        action: "normalize_whitespace",
        field: "title",
        beforeValue: title,
        afterValue: cleanedTitle
      });
    }

    const cleanedBody = body.replace(/\s+/g, " ");
    if (cleanedBody !== body) {
      events.push({
        action: "normalize_whitespace",
        field: "body",
        beforeValue: body,
        afterValue: cleanedBody
      });
    }

    const canonicalUrl = this.normalizeUrl(rawUrl);
    if (canonicalUrl !== rawUrl) {
      events.push({
        action: "normalize_url",
        field: "url",
        beforeValue: rawUrl,
        afterValue: canonicalUrl,
        metadata: { strategy: "protocol-host-query-canonicalization" }
      });
    }

    const anomalies: string[] = [];
    if (cleanedTitle.length < 10) {
      anomalies.push("Title is unusually short");
    }
    if (cleanedBody.length < 50) {
      anomalies.push("Body content is unusually short");
    }
    if (!canonicalUrl.startsWith("http://") && !canonicalUrl.startsWith("https://")) {
      anomalies.push("URL does not appear to be a valid web URL");
    }

    const publishedAt = item.publishedAt ? new Date(item.publishedAt) : undefined;
    if (publishedAt && Number.isNaN(publishedAt.getTime())) {
      anomalies.push("Published date could not be parsed");
    }

    const contentHash = createHash("sha256")
      .update(`${cleanedTitle}|${cleanedBody}|${canonicalUrl}`)
      .digest("hex");

    return {
      item: {
        title: cleanedTitle,
        body: cleanedBody,
        rawUrl,
        canonicalUrl,
        source,
        sourceExternalId: item.sourceExternalId,
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined,
        anomalies,
        contentHash
      },
      events
    };
  }

  async logEvents(
    userId: string | undefined,
    storyVersionId: string,
    events: CleansingEventDraft[]
  ): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.prisma.cleansingEvent.createMany({
      data: events.map((event) => ({
        userId,
        storyVersionId,
        action: event.action,
        field: event.field,
        beforeValue: event.beforeValue,
        afterValue: event.afterValue,
        metadata: event.metadata
      }))
    });
  }

  normalizeUrl(input: string): string {
    const candidate = input.trim();
    if (!candidate) {
      return "";
    }

    let working = candidate;
    if (!/^https?:\/\//i.test(working)) {
      working = `https://${working}`;
    }

    try {
      const url = new URL(working);
      url.protocol = url.protocol.toLowerCase();
      url.hostname = url.hostname.toLowerCase();
      if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
        url.port = "";
      }

      const params = new URLSearchParams(url.search);
      ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid"].forEach((key) =>
        params.delete(key)
      );
      const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
      url.search = sorted.length > 0 ? `?${new URLSearchParams(sorted).toString()}` : "";
      url.hash = "";
      url.pathname = url.pathname.replace(/\/+$/, "") || "/";

      return url.toString();
    } catch {
      return candidate;
    }
  }
}
