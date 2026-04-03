import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuthActor, hasAdminOverride } from "../../common/authz/object-access.policy";
import { PrismaService } from "../prisma/prisma.service";
import { AuditLogsService } from "../audit-logs/audit-logs.service";
import { MergeRequestDto } from "./dto/merge-request.dto";
import { RepairRequestDto } from "./dto/repair-request.dto";
import { CleansingService } from "../cleansing/cleansing.service";

@Injectable()
export class MergeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly cleansingService: CleansingService
  ) {}

  async getQueue() {
    const versions = await this.prisma.storyVersion.findMany({
      where: {
        OR: [{ duplicateFlag: true }, { anomalyFlag: true }]
      },
      include: {
        story: {
          include: {
            clusterMembers: {
              include: {
                cluster: {
                  include: {
                    members: {
                      include: {
                        story: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    const queue = await Promise.all(
      versions.map(async (version: any) => {
        const previous = await this.prisma.storyVersion.findFirst({
          where: {
            storyId: version.storyId,
            versionNumber: {
              lt: version.versionNumber
            }
          },
          orderBy: { versionNumber: "desc" }
        });

        const clusterMember = version.story.clusterMembers[0];
        const clusterCandidates = (clusterMember?.cluster.members ?? []).filter((member: any) => member.storyId !== version.storyId);
        const candidate = clusterCandidates[0];

        return {
          queueId: version.id,
          storyId: version.storyId,
          versionId: version.id,
          versionNumber: version.versionNumber,
          previousVersionId: previous?.id,
          normalizedUrl: version.canonicalUrl,
          title: version.title,
          nearDuplicate: version.duplicateFlag,
          suspiciousAnomaly: version.anomalyFlag,
          duplicateExplanation: version.duplicateExplanation,
          anomalyExplanation: version.anomalyExplanation,
          suggestedTargetStoryId: candidate?.storyId,
          mergeTargets: clusterCandidates.map((member: any) => ({
            storyId: member.storyId,
            title: member.story.latestTitle,
            canonicalUrl: member.story.canonicalUrl,
            confidence: member.confidence
          })),
          similarityConfidence: clusterMember?.confidence ?? null,
          createdAt: version.createdAt
        };
      })
    );

    return { items: queue };
  }

  async getDiff(actor: AuthActor | undefined, storyId: string, leftVersionId: string, rightVersionId: string) {
    const [left, right] = await Promise.all([
      this.prisma.storyVersion.findFirst({ where: { id: leftVersionId, storyId } }),
      this.prisma.storyVersion.findFirst({ where: { id: rightVersionId, storyId } })
    ]);
    if (!left || !right) {
      throw new NotFoundException("Version pair not found for story");
    }

    await this.assertDiffAccess(actor, right.id);

    const fields: Array<{ field: string; left: string; right: string; changed: boolean }> = [
      { field: "title", left: left.title, right: right.title, changed: left.title !== right.title },
      { field: "body", left: left.body, right: right.body, changed: left.body !== right.body },
      {
        field: "normalizedUrl",
        left: left.canonicalUrl,
        right: right.canonicalUrl,
        changed: left.canonicalUrl !== right.canonicalUrl
      },
      { field: "source", left: left.source, right: right.source, changed: left.source !== right.source },
      {
        field: "sourceExternalId",
        left: left.sourceExternalId ?? "",
        right: right.sourceExternalId ?? "",
        changed: (left.sourceExternalId ?? "") !== (right.sourceExternalId ?? "")
      }
    ];

    return {
      storyId,
      leftVersionId,
      rightVersionId,
      fields
    };
  }

  async merge(actor: AuthActor | undefined, payload: MergeRequestDto) {
    const userId = actor?.userId;
    const incoming = await this.prisma.storyVersion.findUnique({
      where: { id: payload.incomingVersionId },
      include: { story: true }
    });
    if (!incoming) {
      throw new NotFoundException("Incoming story version not found");
    }

    await this.assertVersionAccess(actor, incoming.id);

    const trimmedNote = payload.note.trim();
    if (!trimmedNote) {
      throw new BadRequestException("Merge note is required");
    }

    const targetStoryId = payload.strategy === "keep_both" ? undefined : payload.targetStoryId;
    if (payload.strategy !== "keep_both" && !targetStoryId) {
      throw new BadRequestException("Target story is required for replace/append strategies");
    }

    const targetStory =
      targetStoryId !== undefined
        ? await this.prisma.story.findUnique({ where: { id: targetStoryId } })
        : null;
    if (payload.strategy !== "keep_both" && !targetStory) {
      throw new NotFoundException("Target story not found");
    }

    if (payload.strategy !== "keep_both" && targetStoryId) {
      const editorCanUseClusterTarget =
        this.hasStoriesReview(actor) && (await this.isClusterMergeTarget(incoming.storyId, targetStoryId));
      if (!editorCanUseClusterTarget) {
        await this.assertStoryAccess(actor, targetStoryId);
      }
    }

    const targetCurrent =
      targetStoryId !== undefined
        ? await this.prisma.storyVersion.findFirst({
            where: { storyId: targetStoryId },
            orderBy: { versionNumber: "desc" }
          })
        : null;

    let afterVersionId = incoming.id;

    if (payload.strategy === "replace" || payload.strategy === "append") {
      const mergedBody =
        payload.strategy === "append"
          ? `${targetCurrent?.body ?? ""}\n\n${incoming.body}`.trim()
          : incoming.body;
      const mergedTitle = payload.strategy === "append" ? targetCurrent?.title ?? incoming.title : incoming.title;

      const created = await this.prisma.storyVersion.create({
        data: {
          storyId: targetStoryId!,
          versionNumber: (targetCurrent?.versionNumber ?? 0) + 1,
          title: mergedTitle,
          body: mergedBody,
          rawUrl: incoming.rawUrl,
          canonicalUrl: incoming.canonicalUrl,
          source: incoming.source,
          sourceExternalId: incoming.sourceExternalId,
          publishedAt: incoming.publishedAt,
          contentHash: incoming.contentHash,
          simhash: incoming.simhash,
          minhashSignature: incoming.minhashSignature,
          duplicateFlag: false,
          anomalyFlag: false,
          duplicateExplanation: null,
          anomalyExplanation: null
        }
      });

      await this.prisma.story.update({
        where: { id: targetStoryId! },
        data: {
          latestTitle: created.title,
          latestBody: created.body,
          canonicalUrl: created.canonicalUrl
        }
      });

      await this.prisma.story.update({
        where: { id: incoming.storyId },
        data: { status: "merged" }
      });
      afterVersionId = created.id;
    }

    await this.prisma.storyVersion.update({
      where: { id: incoming.id },
      data: {
        duplicateFlag: false,
        anomalyFlag: false,
        duplicateExplanation: null,
        anomalyExplanation: null
      }
    });

    await this.auditLogs.write({
      userId,
      actionType: "MERGE_APPLIED",
      entityType: "story",
      entityId: targetStoryId ?? incoming.storyId,
      notes: trimmedNote,
      metadata: {
        actor: userId,
        targetStoryId: targetStoryId ?? incoming.storyId,
        incomingStoryId: incoming.storyId,
        incomingVersionId: incoming.id,
        strategy: payload.strategy,
        note: trimmedNote,
        beforeRef: targetCurrent
          ? {
              storyId: targetCurrent.storyId,
              versionId: targetCurrent.id,
              contentHash: targetCurrent.contentHash
            }
          : null,
        afterRef: {
          storyId: targetStoryId ?? incoming.storyId,
          versionId: afterVersionId,
          contentHash: incoming.contentHash
        }
      }
    });

    return {
      status: "ok",
      strategy: payload.strategy,
      mergedIntoStoryId: targetStoryId ?? incoming.storyId,
      resultingVersionId: afterVersionId
    };
  }

  async repairVersion(actor: AuthActor | undefined, versionId: string, payload: RepairRequestDto) {
    const userId = actor?.userId;
    const current = await this.prisma.storyVersion.findUnique({ where: { id: versionId } });
    if (!current) {
      throw new NotFoundException("Story version not found");
    }

    await this.assertVersionAccess(actor, current.id);

    const repaired = this.cleansingService.cleanse(
      {
        title: payload.title ?? current.title,
        body: payload.body ?? current.body,
        url: payload.url ?? current.rawUrl,
        source: current.source,
        sourceExternalId: current.sourceExternalId ?? undefined
      },
      current.source
    );

    const created = await this.prisma.storyVersion.create({
      data: {
        storyId: current.storyId,
        versionNumber: current.versionNumber + 1,
        title: repaired.item.title,
        body: repaired.item.body,
        rawUrl: repaired.item.rawUrl,
        canonicalUrl: repaired.item.canonicalUrl,
        source: current.source,
        sourceExternalId: current.sourceExternalId,
        publishedAt: current.publishedAt,
        contentHash: repaired.item.contentHash,
        simhash: current.simhash,
        minhashSignature: current.minhashSignature,
        duplicateFlag: false,
        anomalyFlag: repaired.item.anomalies.length > 0,
        duplicateExplanation: null,
        anomalyExplanation: repaired.item.anomalies.join(" ") || null
      }
    });

    await this.prisma.story.update({
      where: { id: current.storyId },
      data: {
        latestTitle: created.title,
        latestBody: created.body,
        canonicalUrl: created.canonicalUrl
      }
    });

    await this.auditLogs.write({
      userId,
      actionType: "REPAIR_APPLIED",
      entityType: "story_version",
      entityId: created.id,
      notes: payload.note.trim(),
      metadata: {
        actor: userId,
        strategy: "repair",
        note: payload.note.trim(),
        targetStoryId: current.storyId,
        beforeRef: {
          storyId: current.storyId,
          versionId: current.id,
          contentHash: current.contentHash
        },
        afterRef: {
          storyId: current.storyId,
          versionId: created.id,
          contentHash: created.contentHash
        }
      }
    });

    return {
      status: "ok",
      repairedVersionId: created.id
    };
  }

  private async assertVersionAccess(actor: AuthActor | undefined, versionId: string): Promise<void> {
    if (hasAdminOverride(actor)) {
      return;
    }

    if (this.hasStoriesReview(actor) && (await this.isEditorQueueVersion(versionId))) {
      return;
    }

    const userId = actor?.userId;
    if (!userId) {
      throw new ForbiddenException("Not authorized for this story version");
    }

    const ownerSignal = await this.prisma.cleansingEvent.findFirst({
      where: {
        storyVersionId: versionId,
        userId
      },
      select: { id: true }
    });

    if (!ownerSignal) {
      throw new ForbiddenException("Not authorized for this story version");
    }
  }

  private async assertDiffAccess(actor: AuthActor | undefined, rightVersionId: string): Promise<void> {
    if (hasAdminOverride(actor)) {
      return;
    }

    if (this.hasStoriesReview(actor) && (await this.isEditorQueueVersion(rightVersionId))) {
      return;
    }

    await this.assertVersionAccess(actor, rightVersionId);
  }

  private async assertStoryAccess(actor: AuthActor | undefined, storyId: string): Promise<void> {
    if (hasAdminOverride(actor)) {
      return;
    }
    const userId = actor?.userId;
    if (!userId) {
      throw new ForbiddenException("Not authorized for target story");
    }

    const ownerSignal = await this.prisma.cleansingEvent.findFirst({
      where: {
        userId,
        storyVersionId: {
          in: (
            await this.prisma.storyVersion.findMany({
              where: { storyId },
              select: { id: true }
            })
          ).map((item: any) => item.id)
        }
      },
      select: { id: true }
    });

    if (!ownerSignal) {
      throw new ForbiddenException("Not authorized for target story");
    }
  }

  private hasStoriesReview(actor: AuthActor | undefined): boolean {
    return (actor?.permissions ?? []).includes("stories.review");
  }

  private async isEditorQueueVersion(versionId: string): Promise<boolean> {
    const version = await this.prisma.storyVersion.findUnique({
      where: { id: versionId },
      select: { duplicateFlag: true, anomalyFlag: true }
    });
    if (!version) {
      return false;
    }
    return version.duplicateFlag || version.anomalyFlag;
  }

  private async isClusterMergeTarget(incomingStoryId: string, targetStoryId: string): Promise<boolean> {
    const member = await this.prisma.dedupClusterMember.findFirst({
      where: {
        storyId: incomingStoryId,
        cluster: {
          members: {
            some: {
              storyId: targetStoryId
            }
          }
        }
      },
      select: { id: true }
    });

    return Boolean(member);
  }
}
