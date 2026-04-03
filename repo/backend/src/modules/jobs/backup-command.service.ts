import { Injectable } from "@nestjs/common";
import { execFile } from "child_process";

@Injectable()
export class BackupCommandService {
  private runShell(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFile(command, args, { env: process.env, cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }

  async runNightlyBackup(scriptPath: string): Promise<{ stdout: string; stderr: string }> {
    return this.runShell("sh", [scriptPath]);
  }

  async runRestoreVerification(scriptPath: string, backupFilePath: string): Promise<{ stdout: string; stderr: string }> {
    const normalized = backupFilePath.trim();
    if (!normalized) {
      throw new Error("Backup file path is required");
    }
    if (normalized.startsWith("-")) {
      throw new Error("Backup file path cannot start with '-'");
    }
    if (normalized.includes("\0")) {
      throw new Error("Backup file path contains unsupported characters");
    }

    return this.runShell("sh", [scriptPath, normalized]);
  }
}
