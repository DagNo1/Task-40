import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";

@Injectable()
export class FingerprintService {
  private readonly shingleSize = 3;
  private readonly minhashSize = 32;

  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1);
  }

  simHash(text: string): bigint {
    const tokens = this.tokenize(text);
    const vector = new Array<number>(64).fill(0);

    tokens.forEach((token) => {
      const hash = this.hash64(token);
      for (let i = 0; i < 64; i += 1) {
        const bit = (hash >> BigInt(i)) & 1n;
        vector[i] += bit === 1n ? 1 : -1;
      }
    });

    let result = 0n;
    for (let i = 0; i < 64; i += 1) {
      if (vector[i] > 0) {
        result |= 1n << BigInt(i);
      }
    }
    return result;
  }

  minHash(text: string): number[] {
    const shingles = this.createShingles(text);
    const signatures: number[] = [];

    for (let i = 0; i < this.minhashSize; i += 1) {
      let min = Number.MAX_SAFE_INTEGER;
      shingles.forEach((shingle) => {
        const hash = this.hash32(`${i}:${shingle}`);
        if (hash < min) {
          min = hash;
        }
      });
      signatures.push(min);
    }

    return signatures;
  }

  hammingDistance(a: bigint, b: bigint): number {
    let xor = a ^ b;
    let count = 0;
    while (xor > 0n) {
      count += Number(xor & 1n);
      xor >>= 1n;
    }
    return count;
  }

  minHashSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }
    let same = 0;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] === b[i]) {
        same += 1;
      }
    }
    return same / a.length;
  }

  private createShingles(text: string): string[] {
    const tokens = this.tokenize(text);
    if (tokens.length <= this.shingleSize) {
      return [tokens.join(" ") || text.toLowerCase()];
    }

    const shingles: string[] = [];
    for (let i = 0; i <= tokens.length - this.shingleSize; i += 1) {
      shingles.push(tokens.slice(i, i + this.shingleSize).join(" "));
    }
    return shingles;
  }

  private hash64(input: string): bigint {
    const hex = createHash("sha256").update(input).digest("hex").slice(0, 16);
    return BigInt(`0x${hex}`);
  }

  private hash32(input: string): number {
    const hex = createHash("sha256").update(input).digest("hex").slice(0, 8);
    return Number.parseInt(hex, 16);
  }
}
