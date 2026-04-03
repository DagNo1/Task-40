import { JobsService } from "../src/modules/jobs/jobs.service";

describe("JobsService operational orchestration", () => {
  function buildService() {
    const prisma = {
      jobRun: {
        create: jest.fn().mockResolvedValue({ id: "run-1" }),
        update: jest.fn().mockResolvedValue(undefined),
        findMany: jest.fn().mockResolvedValue([])
      },
      alertEvent: {
        create: jest.fn().mockResolvedValue(undefined),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([])
      },
      notificationBanner: {
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue(undefined),
        create: jest.fn().mockResolvedValue(undefined)
      },
      systemThresholdConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(undefined)
      },
      immutableAuditLog: {
        count: jest.fn().mockResolvedValue(0)
      },
      paymentChannelRequest: {
        findMany: jest.fn().mockResolvedValue([])
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([])
      }
    } as any;

    const queue = {
      onJob: jest.fn(),
      enqueue: jest.fn().mockResolvedValue(undefined),
      depth: jest.fn().mockResolvedValue(0)
    } as any;

    const auditLogs = {
      write: jest.fn().mockResolvedValue(undefined)
    } as any;

    const observability = {
      recordMetric: jest.fn().mockResolvedValue(undefined),
      recordTrace: jest.fn().mockResolvedValue(undefined),
      recordLog: jest.fn().mockResolvedValue(undefined),
      cleanupRetention: jest.fn().mockResolvedValue({ removed: 3 })
    } as any;

    const backupCommands = {
      runNightlyBackup: jest.fn().mockResolvedValue({ stdout: "ok", stderr: "" }),
      runRestoreVerification: jest.fn().mockResolvedValue({ stdout: "PASS", stderr: "" })
    } as any;

    const service = new JobsService(prisma, queue, auditLogs, observability, backupCommands);
    return { service, prisma, queue, auditLogs, observability, backupCommands };
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it("enqueues nightly backup and cadence jobs at scheduled minute", async () => {
    const localTwoAM = new Date("2026-03-30T00:00:00.000Z");
    localTwoAM.setHours(2, 0, 0, 0);
    jest.useFakeTimers().setSystemTime(localTwoAM);
    const { service, queue, prisma } = buildService();

    await (service as any).tickScheduler();

    expect(queue.enqueue).toHaveBeenCalledWith("nightly_backup");
    expect(queue.enqueue).toHaveBeenCalledWith("reconciliation");
    expect(queue.enqueue).toHaveBeenCalledWith("notification_banners");
    expect(prisma.systemThresholdConfig.upsert).toHaveBeenCalled();
  });

  it("records success metrics and retention audit details for retention cleanup", async () => {
    const { service, observability, auditLogs } = buildService();

    await (service as any).processJob("retention_cleanup");

    expect(auditLogs.write).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "OBS_RETENTION_CLEANUP" })
    );
    expect(observability.recordMetric).toHaveBeenCalledWith("obs_retention_removed_files", 3);
    expect(observability.recordMetric).toHaveBeenCalledWith("job_success", 1, { jobType: "retention_cleanup" });
  });

  it("emits backup and queue failure alerts/audits when nightly backup command fails", async () => {
    const { service, prisma, observability, auditLogs, backupCommands } = buildService();
    backupCommands.runNightlyBackup.mockRejectedValue(new Error("backup command failure"));

    await (service as any).processJob("nightly_backup");

    const categories = prisma.alertEvent.create.mock.calls.map((args: [{ data: { category: string } }]) => args[0].data.category);
    expect(categories).toContain("backup_failure");
    expect(categories).toContain("queue_job_failure");

    const actions = auditLogs.write.mock.calls.map((args: [{ actionType: string }]) => args[0].actionType);
    expect(actions).toContain("BACKUP_FAILURE");
    expect(actions).toContain("JOB_FAILURE");

    expect(observability.recordMetric).toHaveBeenCalledWith("job_failure", 1, { jobType: "nightly_backup" });
  });
});
