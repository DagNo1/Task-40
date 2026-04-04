import { Injectable } from "@nestjs/common";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { PrismaService } from "../prisma/prisma.service";
import { FingerprintService } from "./fingerprint.service";

export interface FingerprintResult {
  simhash: string;
  minhashSignature: string;
}

export interface DedupOutcome {
  duplicate: boolean;
  anomaly: boolean;
  confidence: number;
  explanation: string;
  groupedBy: string;
  clusterId?: string;
  details: InputJsonValue;
}

interface MatchCandidate {
  storyId: string;
  canonicalUrl: string;
  simDistance: number;
  minSimilarity: number;
  groupedBy: string;
}

@Injectable()
export class DedupService {
  private readonly simhashMaxDistance = Number(process.env.SIMHASH_MAX_HAMMING ?? 8);
  private readonly minhashMinSimilarity = Number(process.env.MINHASH_MIN_SIMILARITY ?? 0.82);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fingerprintService: FingerprintService
  ) {}

  fingerprint(title: string, body: string): FingerprintResult {
    const text = `${title} ${body}`;
    const simhash = this.fingerprintService.simHash(text).toString(16);
    const minhash = this.fingerprintService.minHash(text).join(",");
    return {
      simhash,
      minhashSignature: minhash
    };
  }

  async clusterAndExplain(input: {
    storyId: string;
    canonicalUrl: string;
    simhash: string;
    minhashSignature: string;
    title: string;
  }): Promise<DedupOutcome> {
    const candidates = await this.prisma.storyVersion.findMany({
      where: {
        OR: [{ canonicalUrl: input.canonicalUrl }, { duplicateFlag: true }, { anomalyFlag: true }]
      },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { story: true }
    });

    let best: MatchCandidate | undefined;

    const currentSim = BigInt(`0x${input.simhash || "0"}`);
    const currentMin = input.minhashSignature.split(",").map((v) => Number.parseInt(v, 10));

    for (const candidate of candidates) {
      const cSim = BigInt(`0x${candidate.simhash || "0"}`);
      const cMin = candidate.minhashSignature
        .split(",")
        .map((v: string) => Number.parseInt(v, 10));
      const simDistance = this.fingerprintService.hammingDistance(currentSim, cSim);
      const minSimilarity = this.fingerprintService.minHashSimilarity(currentMin, cMin);

      const groupedBy =
        candidate.canonicalUrl === input.canonicalUrl
          ? "normalized_url"
          : simDistance <= this.simhashMaxDistance
            ? "simhash"
            : minSimilarity >= this.minhashMinSimilarity
              ? "minhash"
              : "none";

      if (groupedBy === "none") {
        continue;
      }

      const score = (1 - simDistance / 64) * 0.6 + minSimilarity * 0.4;
      if (!best || score > (1 - best.simDistance / 64) * 0.6 + best.minSimilarity * 0.4) {
        best = {
          storyId: candidate.storyId,
          canonicalUrl: candidate.canonicalUrl,
          simDistance,
          minSimilarity,
          groupedBy
        };
      }
    }

    if (!best) {
      return {
        duplicate: false,
        anomaly: false,
        confidence: 0,
        explanation: "No near-duplicate candidates crossed URL or fingerprint thresholds.",
        groupedBy: "none",
        details: {
          simhashMaxDistance: this.simhashMaxDistance,
          minhashMinSimilarity: this.minhashMinSimilarity
        }
      };
    }

    const confidence = Math.max(
      0,
      Math.min(1, (1 - best.simDistance / 64) * 0.55 + best.minSimilarity * 0.45)
    );
    const duplicate = best.groupedBy === "normalized_url" || confidence >= 0.74;
    const anomaly = !duplicate && confidence >= 0.6;

    const cluster = await this.upsertCluster(input.storyId, best, confidence, duplicate, anomaly);

    const explanation = duplicate
      ? `Grouped as duplicate via ${best.groupedBy}; similarity confidence ${(confidence * 100).toFixed(1)}%.`
      : anomaly
        ? `Flagged suspicious: fingerprints partially matched existing story (simhash distance ${best.simDistance}, minhash ${(best.minSimilarity * 100).toFixed(1)}%).`
        : "Similarity remained below duplicate/anomaly thresholds.";

    return {
      duplicate,
      anomaly,
      confidence,
      explanation,
      groupedBy: best.groupedBy,
      clusterId: cluster?.id,
      details: {
        matchedStoryId: best.storyId,
        simhashDistance: best.simDistance,
        minhashSimilarity: best.minSimilarity,
        thresholds: {
          simhashMaxDistance: this.simhashMaxDistance,
          minhashMinSimilarity: this.minhashMinSimilarity
        }
      }
    };
  }

  private async upsertCluster(
    storyId: string,
    best: { storyId: string; canonicalUrl: string; simDistance: number; minSimilarity: number; groupedBy: string },
    confidence: number,
    duplicate: boolean,
    anomaly: boolean
  ) {
    if (!duplicate && !anomaly) {
      return null;
    }

    const clusterKey = `url:${best.canonicalUrl}`;
    const cluster = await this.prisma.dedupCluster.upsert({
      where: { key: clusterKey },
      update: {
        confidence,
        reason: duplicate ? "duplicate" : "suspicious",
        explanation:
          duplicate
            ? `Stories share normalized URL and/or high fingerprint similarity.`
            : `Stories have partial fingerprint overlap that indicates suspicious near-duplicate behavior.`,
        similarityDetails: {
          simhashDistance: best.simDistance,
          minhashSimilarity: best.minSimilarity,
          groupedBy: best.groupedBy
        }
      },
      create: {
        key: clusterKey,
        reason: duplicate ? "duplicate" : "suspicious",
        confidence,
        explanation:
          duplicate
            ? `Stories share normalized URL and/or high fingerprint similarity.`
            : `Stories have partial fingerprint overlap that indicates suspicious near-duplicate behavior.`,
        similarityDetails: {
          simhashDistance: best.simDistance,
          minhashSimilarity: best.minSimilarity,
          groupedBy: best.groupedBy
        }
      }
    });

    await this.prisma.dedupClusterMember.upsert({
      where: {
        clusterId_storyId: {
          clusterId: cluster.id,
          storyId
        }
      },
      update: {
        confidence,
        similarityScore: confidence,
        groupedBy: best.groupedBy
      },
      create: {
        clusterId: cluster.id,
        storyId,
        confidence,
        similarityScore: confidence,
        groupedBy: best.groupedBy
      }
    });

    await this.prisma.dedupClusterMember.upsert({
      where: {
        clusterId_storyId: {
          clusterId: cluster.id,
          storyId: best.storyId
        }
      },
      update: {
        confidence,
        similarityScore: confidence,
        groupedBy: best.groupedBy
      },
      create: {
        clusterId: cluster.id,
        storyId: best.storyId,
        confidence,
        similarityScore: confidence,
        groupedBy: best.groupedBy
      }
    });

    return cluster;
  }
}
