import { DedupService } from "../src/modules/dedup/dedup.service";

describe("DedupService", () => {
  it("clusters duplicate candidates using normalized URL/fingerprint similarity", async () => {
    const prisma = {
      storyVersion: {
        findMany: jest.fn().mockResolvedValue([
          {
            storyId: "existing-story",
            canonicalUrl: "https://example.com/story",
            simhash: "a",
            minhashSignature: "1,2,3",
            duplicateFlag: true,
            anomalyFlag: false,
            createdAt: new Date(),
            story: {}
          }
        ])
      },
      dedupCluster: {
        upsert: jest.fn().mockResolvedValue({ id: "cluster-1" })
      },
      dedupClusterMember: {
        upsert: jest.fn().mockResolvedValue({})
      }
    } as any;

    const fingerprint = {
      simHash: jest.fn(),
      minHash: jest.fn(),
      hammingDistance: jest.fn().mockReturnValue(0),
      minHashSimilarity: jest.fn().mockReturnValue(1)
    } as any;

    const service = new DedupService(prisma, fingerprint);
    const result = await service.clusterAndExplain({
      storyId: "new-story",
      canonicalUrl: "https://example.com/story",
      simhash: "a",
      minhashSignature: "1,2,3",
      title: "Story"
    });

    expect(result.duplicate).toBe(true);
    expect(result.clusterId).toBe("cluster-1");
  });
});
