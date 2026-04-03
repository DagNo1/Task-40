import { Injectable } from "@nestjs/common";
import { mkdir, appendFile, readdir, stat, unlink } from "fs/promises";
import { join } from "path";

type StreamType = "metrics" | "logs" | "traces";

@Injectable()
export class ObservabilityService {
  private readonly basePath = join(process.cwd(), "storage", "observability");
  private readonly retentionMs = 14 * 24 * 60 * 60 * 1000;

  async recordMetric(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    await this.write("metrics", {
      ts: new Date().toISOString(),
      name,
      value,
      tags: tags ?? {}
    });
  }

  async recordLog(level: "info" | "warn" | "error", message: string, context?: Record<string, unknown>) {
    await this.write("logs", {
      ts: new Date().toISOString(),
      level,
      message,
      context: context ?? {}
    });
  }

  async recordTrace(span: string, details?: Record<string, unknown>) {
    await this.write("traces", {
      ts: new Date().toISOString(),
      span,
      details: details ?? {}
    });
  }

  async cleanupRetention(): Promise<{ removed: number }> {
    let removed = 0;
    for (const stream of ["metrics", "logs", "traces"] as StreamType[]) {
      const dir = join(this.basePath, stream);
      await mkdir(dir, { recursive: true });
      const files = await readdir(dir);
      for (const file of files) {
        const full = join(dir, file);
        const info = await stat(full);
        if (Date.now() - info.mtimeMs > this.retentionMs) {
          await unlink(full);
          removed += 1;
        }
      }
    }
    return { removed };
  }

  private async write(stream: StreamType, payload: Record<string, unknown>): Promise<void> {
    const day = new Date().toISOString().slice(0, 10);
    const dir = join(this.basePath, stream);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, `${day}.jsonl`);
    await appendFile(filePath, `${JSON.stringify(payload)}\n`, "utf8");
  }
}
