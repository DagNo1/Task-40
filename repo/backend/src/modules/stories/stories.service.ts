import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

interface StoryUpsertInput {
  title: string;
  body: string;
  source: string;
  sourceExternalId?: string;
  canonicalUrl: string;
}

interface StoryVersionInput {
  storyId: string;
  title: string;
  body: string;
  source: string;
  sourceExternalId?: string;
  rawUrl: string;
  canonicalUrl: string;
  publishedAt?: Date;
  contentHash: string;
  simhash: string;
  minhashSignature: string;
  duplicateFlag: boolean;
  anomalyFlag: boolean;
  duplicateExplanation?: string;
  anomalyExplanation?: string;
}

interface StoryListRecord {
  id: string;
  latestTitle: string;
  canonicalUrl: string;
  source: string;
  status: string;
  updatedAt: Date;
  createdAt: Date;
  versions: Array<{
    createdAt: Date;
    versionNumber: number;
  }>;
}

@Injectable()
export class StoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listStories(query?: string) {
    const normalizedQuery = query?.trim();
    const stories = await this.prisma.story.findMany({
      where: normalizedQuery
        ? {
            OR: [
              { latestTitle: { contains: normalizedQuery, mode: "insensitive" } },
              { canonicalUrl: { contains: normalizedQuery, mode: "insensitive" } }
            ]
          }
        : undefined,
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true, versionNumber: true }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 500
    });

    return {
      items: stories.map((story: StoryListRecord) => ({
        id: story.id,
        title: story.latestTitle,
        canonicalUrl: story.canonicalUrl,
        source: story.source,
        status: story.status,
        updatedAt: story.updatedAt,
        createdAt: story.createdAt,
        latestVersionNumber: story.versions[0]?.versionNumber ?? null,
        latestVersionAt: story.versions[0]?.createdAt ?? null
      }))
    };
  }

  async upsertStory(input: StoryUpsertInput): Promise<{ id: string }> {
    const existing = await this.prisma.story.findFirst({
      where: {
        OR: [
          { canonicalUrl: input.canonicalUrl },
          input.sourceExternalId
            ? {
                source: input.source,
                sourceExternalId: input.sourceExternalId
              }
            : undefined
        ].filter(Boolean) as Array<Record<string, unknown>>
      },
      orderBy: { createdAt: "asc" }
    });

    if (existing) {
      const updated = await this.prisma.story.update({
        where: { id: existing.id },
        data: {
          latestTitle: input.title,
          latestBody: input.body,
          canonicalUrl: input.canonicalUrl,
          sourceExternalId: input.sourceExternalId
        }
      });
      return { id: updated.id };
    }

    const created = await this.prisma.story.create({
      data: {
        source: input.source,
        sourceExternalId: input.sourceExternalId,
        canonicalUrl: input.canonicalUrl,
        latestTitle: input.title,
        latestBody: input.body
      }
    });
    return { id: created.id };
  }

  async createVersion(input: StoryVersionInput): Promise<{ id: string; versionNumber: number }> {
    const last = await this.prisma.storyVersion.findFirst({
      where: { storyId: input.storyId },
      orderBy: { versionNumber: "desc" }
    });

    const version = await this.prisma.storyVersion.create({
      data: {
        storyId: input.storyId,
        versionNumber: (last?.versionNumber ?? 0) + 1,
        title: input.title,
        body: input.body,
        source: input.source,
        sourceExternalId: input.sourceExternalId,
        rawUrl: input.rawUrl,
        canonicalUrl: input.canonicalUrl,
        publishedAt: input.publishedAt,
        contentHash: input.contentHash,
        simhash: input.simhash,
        minhashSignature: input.minhashSignature,
        duplicateFlag: input.duplicateFlag,
        anomalyFlag: input.anomalyFlag,
        duplicateExplanation: input.duplicateExplanation,
        anomalyExplanation: input.anomalyExplanation
      }
    });

    return {
      id: version.id,
      versionNumber: version.versionNumber
    };
  }
}
