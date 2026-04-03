import { FingerprintService } from "../src/modules/dedup/fingerprint.service";

describe("FingerprintService", () => {
  it("produces closer similarity for related text", () => {
    const service = new FingerprintService();
    const a = "city council approves school budget amid heated debate";
    const b = "city council approved school budget after a heated debate";
    const c = "sports team wins championship after overtime";

    const simA = service.simHash(a);
    const simB = service.simHash(b);
    const simC = service.simHash(c);

    const dAB = service.hammingDistance(simA, simB);
    const dAC = service.hammingDistance(simA, simC);
    expect(dAB).toBeLessThan(dAC);

    const mAB = service.minHashSimilarity(service.minHash(a), service.minHash(b));
    const mAC = service.minHashSimilarity(service.minHash(a), service.minHash(c));
    expect(mAB).toBeGreaterThanOrEqual(mAC);
  });
});
