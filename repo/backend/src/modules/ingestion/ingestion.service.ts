import { BadRequestException, Injectable } from "@nestjs/common";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { CleansingService, RawIngestionItem } from "../cleansing/cleansing.service";
import { DedupService } from "../dedup/dedup.service";
import { StoriesService } from "../stories/stories.service";

export interface IngestionRunResult {
  accepted: number;
  rejected: number;
  duplicates: number;
  anomalies: number;
  stories: Array<{
    storyId: string;
    versionId: string;
    clusterId?: string;
    duplicate: boolean;
    anomaly: boolean;
    explanation: string;
  }>;
}

@Injectable()
export class IngestionService {
  constructor(
    private readonly cleansingService: CleansingService,
    private readonly dedupService: DedupService,
    private readonly storiesService: StoriesService,
    private readonly auditLogsService: AuditLogsService
  ) {}

  async ingest(items: RawIngestionItem[], source: string, userId?: string): Promise<IngestionRunResult> {
    if (items.length === 0) {
      throw new BadRequestException("No ingestion records were provided");
    }

    const results: IngestionRunResult = {
      accepted: 0,
      rejected: 0,
      duplicates: 0,
      anomalies: 0,
      stories: []
    };

    for (const raw of items) {
      if (!raw.url || !raw.title) {
        results.rejected += 1;
        continue;
      }

      const cleansed = this.cleansingService.cleanse(raw, source);
      const fingerprints = this.dedupService.fingerprint(cleansed.item.title, cleansed.item.body);

      const story = await this.storiesService.upsertStory({
        title: cleansed.item.title,
        body: cleansed.item.body,
        source: cleansed.item.source,
        sourceExternalId: cleansed.item.sourceExternalId,
        canonicalUrl: cleansed.item.canonicalUrl
      });

      const dedup = await this.dedupService.clusterAndExplain({
        storyId: story.id,
        canonicalUrl: cleansed.item.canonicalUrl,
        simhash: fingerprints.simhash,
        minhashSignature: fingerprints.minhashSignature,
        title: cleansed.item.title
      });

      const version = await this.storiesService.createVersion({
        storyId: story.id,
        title: cleansed.item.title,
        body: cleansed.item.body,
        source: cleansed.item.source,
        sourceExternalId: cleansed.item.sourceExternalId,
        rawUrl: cleansed.item.rawUrl,
        canonicalUrl: cleansed.item.canonicalUrl,
        publishedAt: cleansed.item.publishedAt,
        contentHash: cleansed.item.contentHash,
        simhash: fingerprints.simhash,
        minhashSignature: fingerprints.minhashSignature,
        duplicateFlag: dedup.duplicate,
        anomalyFlag: dedup.anomaly || cleansed.item.anomalies.length > 0,
        duplicateExplanation: dedup.duplicate ? dedup.explanation : undefined,
        anomalyExplanation:
          dedup.anomaly || cleansed.item.anomalies.length > 0
            ? [dedup.explanation, ...cleansed.item.anomalies].filter(Boolean).join(" ")
            : undefined
      });

      await this.cleansingService.logEvents(userId, version.id, cleansed.events);
      for (const anomaly of cleansed.item.anomalies) {
        await this.auditLogsService.write({
          userId,
          actionType: "ANOMALY_FLAGGED",
          entityType: "story_version",
          entityId: version.id,
          notes: anomaly,
          metadata: {
            source: cleansed.item.source,
            canonicalUrl: cleansed.item.canonicalUrl
          }
        });
      }

      for (const event of cleansed.events) {
        await this.auditLogsService.write({
          userId,
          actionType: "CLEANSING_APPLIED",
          entityType: "story_version",
          entityId: version.id,
          notes: `${event.field} ${event.action}`,
          metadata: {
            before: event.beforeValue,
            after: event.afterValue,
            details: event.metadata
          }
        });
      }

      if (dedup.duplicate || dedup.anomaly) {
        await this.auditLogsService.write({
          userId,
          actionType: dedup.duplicate ? "DEDUP_CLUSTERED" : "SUSPICIOUS_CLUSTERED",
          entityType: "dedup_cluster",
          entityId: dedup.clusterId,
          notes: dedup.explanation,
          metadata: dedup.details
        });
      }

      results.accepted += 1;
      if (dedup.duplicate) {
        results.duplicates += 1;
      }
      if (dedup.anomaly || cleansed.item.anomalies.length > 0) {
        results.anomalies += 1;
      }

      results.stories.push({
        storyId: story.id,
        versionId: version.id,
        clusterId: dedup.clusterId,
        duplicate: dedup.duplicate,
        anomaly: dedup.anomaly || cleansed.item.anomalies.length > 0,
        explanation: [dedup.explanation, ...cleansed.item.anomalies].filter(Boolean).join(" ")
      });
    }

    return results;
  }
}
