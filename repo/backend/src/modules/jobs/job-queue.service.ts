import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { RedisService } from "../cache/redis.service";

export type JobType =
  | "reconciliation"
  | "notification_banners"
  | "nightly_backup"
  | "retention_cleanup";

@Injectable()
export class JobQueueService implements OnModuleInit, OnModuleDestroy {
  private running = false;
  private worker: NodeJS.Timeout | null = null;
  private readonly queueKey = "jobs:local-queue";
  private handler?: (job: { type: JobType; payload?: Record<string, unknown> }) => Promise<void>;

  constructor(private readonly redis: RedisService) {}

  onJob(handler: (job: { type: JobType; payload?: Record<string, unknown> }) => Promise<void>) {
    this.handler = handler;
  }

  async enqueue(type: JobType, payload?: Record<string, unknown>): Promise<void> {
    await this.redis.raw.rpush(this.queueKey, JSON.stringify({ type, payload, ts: Date.now() }));
  }

  async depth(): Promise<number> {
    return this.redis.raw.llen(this.queueKey);
  }

  async onModuleInit(): Promise<void> {
    this.running = true;
    this.worker = setInterval(() => {
      void this.consumeOne();
    }, 1000);
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    if (this.worker) {
      clearInterval(this.worker);
      this.worker = null;
    }
  }

  private async consumeOne() {
    if (!this.running || !this.handler) {
      return;
    }
    const item = await this.redis.raw.lpop(this.queueKey);
    if (!item) {
      return;
    }
    try {
      const parsed = JSON.parse(item) as { type: JobType; payload?: Record<string, unknown> };
      await this.handler(parsed);
    } catch {
      // swallow to keep worker alive
    }
  }
}
