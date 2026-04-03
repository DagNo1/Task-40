import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { MergeService } from "../src/modules/merge/merge.service";

describe("MergeService", () => {
  it("requires note on merge", async () => {
    const prisma = {
      storyVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: "v1",
          storyId: "s1",
          title: "a",
          body: "b",
          rawUrl: "https://x",
          canonicalUrl: "https://x",
          source: "feed",
          sourceExternalId: null,
          publishedAt: null,
          contentHash: "h",
          simhash: "1",
          minhashSignature: "1,2"
        })
      },
      story: { findUnique: jest.fn() },
      cleansingEvent: { findFirst: jest.fn().mockResolvedValue({ id: "ce-1" }) }
    } as any;
    const audit = { write: jest.fn() } as any;
    const cleansing = { cleanse: jest.fn() } as any;
    const service = new MergeService(prisma, audit, cleansing);

    await expect(
      service.merge({ userId: "u1" }, {
        incomingVersionId: "v1",
        strategy: "keep_both",
        note: "   "
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects merge when caller is outside object scope", async () => {
    const prisma = {
      storyVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: "v1",
          storyId: "s1",
          title: "a",
          body: "b",
          rawUrl: "https://x",
          canonicalUrl: "https://x",
          source: "feed",
          sourceExternalId: null,
          publishedAt: null,
          contentHash: "h",
          simhash: "1",
          minhashSignature: "1,2"
        })
      },
      cleansingEvent: { findFirst: jest.fn().mockResolvedValue(null) },
      story: { findUnique: jest.fn() }
    } as any;
    const service = new MergeService(prisma, { write: jest.fn() } as any, { cleanse: jest.fn() } as any);

    await expect(
      service.merge(
        { userId: "other-user", permissions: ["stories.review"] },
        { incomingVersionId: "v1", strategy: "keep_both", note: "valid note" }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects repair when caller is outside object scope", async () => {
    const prisma = {
      storyVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: "v1",
          storyId: "s1",
          versionNumber: 1,
          title: "a",
          body: "b",
          rawUrl: "https://x",
          canonicalUrl: "https://x",
          source: "feed",
          sourceExternalId: null,
          publishedAt: null,
          contentHash: "h",
          simhash: "1",
          minhashSignature: "1,2"
        })
      },
      cleansingEvent: { findFirst: jest.fn().mockResolvedValue(null) }
    } as any;
    const service = new MergeService(prisma, { write: jest.fn() } as any, { cleanse: jest.fn() } as any);

    await expect(
      service.repairVersion(
        { userId: "other-user", permissions: ["stories.review"] },
        "v1",
        { note: "valid note" }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("applies keep_both merge strategy successfully", async () => {
    const storyVersionUpdate = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      storyVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: "v1",
          storyId: "s1",
          title: "Incoming title",
          body: "Incoming body",
          rawUrl: "https://x",
          canonicalUrl: "https://x",
          source: "feed",
          sourceExternalId: null,
          publishedAt: null,
          contentHash: "h",
          simhash: "1",
          minhashSignature: "1,2"
        }),
        update: storyVersionUpdate
      },
      cleansingEvent: {
        findFirst: jest.fn().mockResolvedValue({ id: "ce-1" })
      }
    } as any;
    const audit = { write: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new MergeService(prisma, audit, { cleanse: jest.fn() } as any);

    const result = await service.merge(
      { userId: "u1", permissions: ["stories.review"] },
      {
        incomingVersionId: "v1",
        strategy: "keep_both",
        note: "valid merge note"
      }
    );

    expect(result.status).toBe("ok");
    expect(result.strategy).toBe("keep_both");
    expect(result.mergedIntoStoryId).toBe("s1");
    expect(storyVersionUpdate).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: {
        duplicateFlag: false,
        anomalyFlag: false,
        duplicateExplanation: null,
        anomalyExplanation: null
      }
    });
    expect(audit.write).toHaveBeenCalled();
  });

  it("applies replace strategy and resolves reviewed incoming version", async () => {
    const storyVersionUpdate = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      storyVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: "incoming-v",
          storyId: "incoming-story",
          title: "Incoming title",
          body: "Incoming body",
          rawUrl: "https://incoming",
          canonicalUrl: "https://incoming",
          source: "feed",
          sourceExternalId: null,
          publishedAt: null,
          contentHash: "incoming-hash",
          simhash: "1",
          minhashSignature: "1,2"
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: "target-v1",
          storyId: "target-story",
          versionNumber: 1,
          title: "Target title",
          body: "Target body",
          contentHash: "target-hash"
        }),
        create: jest.fn().mockResolvedValue({
          id: "target-v2",
          storyId: "target-story",
          versionNumber: 2,
          title: "Incoming title",
          body: "Incoming body",
          canonicalUrl: "https://incoming"
        }),
        update: storyVersionUpdate
      },
      story: {
        findUnique: jest.fn().mockResolvedValue({ id: "target-story" }),
        update: jest.fn().mockResolvedValue(undefined)
      },
      dedupClusterMember: { findFirst: jest.fn().mockResolvedValue(null) }
    } as any;
    const audit = { write: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new MergeService(prisma, audit, { cleanse: jest.fn() } as any);

    const result = await service.merge(
      { userId: "admin-user", roles: ["admin"], permissions: ["admin.manage", "stories.review"] },
      {
        incomingVersionId: "incoming-v",
        targetStoryId: "target-story",
        strategy: "replace",
        note: "replace decision note"
      }
    );

    expect(result.status).toBe("ok");
    expect(result.strategy).toBe("replace");
    expect(result.resultingVersionId).toBe("target-v2");
    expect(storyVersionUpdate).toHaveBeenCalledWith({
      where: { id: "incoming-v" },
      data: {
        duplicateFlag: false,
        anomalyFlag: false,
        duplicateExplanation: null,
        anomalyExplanation: null
      }
    });
    expect(audit.write).toHaveBeenCalled();
  });

  it("applies append strategy and resolves reviewed incoming version", async () => {
    const storyVersionUpdate = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      storyVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: "incoming-v",
          storyId: "incoming-story",
          title: "Incoming title",
          body: "Incoming body",
          rawUrl: "https://incoming",
          canonicalUrl: "https://incoming",
          source: "feed",
          sourceExternalId: null,
          publishedAt: null,
          contentHash: "incoming-hash",
          simhash: "1",
          minhashSignature: "1,2"
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: "target-v1",
          storyId: "target-story",
          versionNumber: 1,
          title: "Target title",
          body: "Target body",
          contentHash: "target-hash"
        }),
        create: jest.fn().mockResolvedValue({
          id: "target-v2",
          storyId: "target-story",
          versionNumber: 2,
          title: "Target title",
          body: "Target body\n\nIncoming body",
          canonicalUrl: "https://incoming"
        }),
        update: storyVersionUpdate
      },
      story: {
        findUnique: jest.fn().mockResolvedValue({ id: "target-story" }),
        update: jest.fn().mockResolvedValue(undefined)
      },
      dedupClusterMember: { findFirst: jest.fn().mockResolvedValue(null) }
    } as any;
    const audit = { write: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new MergeService(prisma, audit, { cleanse: jest.fn() } as any);

    const result = await service.merge(
      { userId: "admin-user", roles: ["admin"], permissions: ["admin.manage", "stories.review"] },
      {
        incomingVersionId: "incoming-v",
        targetStoryId: "target-story",
        strategy: "append",
        note: "append decision note"
      }
    );

    expect(result.status).toBe("ok");
    expect(result.strategy).toBe("append");
    expect(result.resultingVersionId).toBe("target-v2");
    expect(storyVersionUpdate).toHaveBeenCalledWith({
      where: { id: "incoming-v" },
      data: {
        duplicateFlag: false,
        anomalyFlag: false,
        duplicateExplanation: null,
        anomalyExplanation: null
      }
    });
    expect(audit.write).toHaveBeenCalled();
  });

  it("builds field-level diff response", async () => {
    const prisma = {
      storyVersion: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: "v1",
            storyId: "s1",
            title: "Old",
            body: "Old body",
            canonicalUrl: "https://a",
            source: "feed",
            sourceExternalId: "x"
          })
          .mockResolvedValueOnce({
            id: "v2",
            storyId: "s1",
            title: "New",
            body: "New body",
            canonicalUrl: "https://b",
            source: "feed",
            sourceExternalId: "y"
          }),
        findUnique: jest.fn().mockResolvedValue({ duplicateFlag: true, anomalyFlag: false })
      }
    } as any;
    const service = new MergeService(prisma, { write: jest.fn() } as any, { cleanse: jest.fn() } as any);

    const result = await service.getDiff({ userId: "u1", permissions: ["stories.review"] }, "s1", "v1", "v2");
    expect(result.fields.some((f) => f.changed)).toBe(true);
  });
});
