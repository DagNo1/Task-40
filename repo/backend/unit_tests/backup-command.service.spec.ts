import { execFile } from "child_process";
import { BackupCommandService } from "../src/modules/jobs/backup-command.service";

jest.mock("child_process", () => ({
  execFile: jest.fn()
}));

describe("BackupCommandService", () => {
  const mockedExecFile = execFile as unknown as jest.Mock;

  beforeEach(() => {
    mockedExecFile.mockReset();
  });

  it("runs nightly backup shell script through execFile", async () => {
    mockedExecFile.mockImplementation(
      (_command: string, _args: string[], _options: unknown, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
        callback(null, "backup-ok", "");
      }
    );

    const service = new BackupCommandService();
    const result = await service.runNightlyBackup("/repo/scripts/backup.sh");

    expect(mockedExecFile).toHaveBeenCalledWith(
      "sh",
      ["/repo/scripts/backup.sh"],
      expect.objectContaining({ cwd: process.cwd() }),
      expect.any(Function)
    );
    expect(result.stdout).toBe("backup-ok");
  });

  it("rejects restore verification paths that start with a dash", async () => {
    const service = new BackupCommandService();
    await expect(service.runRestoreVerification("/repo/scripts/restore_verify.sh", "--unsafe")).rejects.toThrow(
      "Backup file path cannot start with '-'"
    );
    expect(mockedExecFile).not.toHaveBeenCalled();
  });
});
