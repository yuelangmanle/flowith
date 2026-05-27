import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, relative, join } from "node:path";
import { compressOutput, isDangerousCommand } from "../core/workspaceRuntime";

export interface NodeWorkspace {
  id: string;
  path: string;
}

export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  workingDirectory: string;
}

export class NodeWorkspaceRuntime {
  constructor(private readonly root: string) {}

  async createWorkspace(slug: string): Promise<NodeWorkspace> {
    const id = `${slug}-${Date.now()}`;
    const workspacePath = resolve(this.root, id);
    await mkdir(workspacePath, { recursive: true });
    return { id, path: workspacePath };
  }

  async writeFile(workspaceId: string, filePath: string, content: string): Promise<void> {
    const target = this.resolveInside(workspaceId, filePath);
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  async runCommand(workspaceId: string, command: string, options: { approved: boolean; timeoutMs?: number }): Promise<CommandResult> {
    if (!options.approved) throw new Error("Command requires approval");
    if (isDangerousCommand(command)) throw new Error("Command is dangerous and blocked");
    const cwd = this.resolveInside(workspaceId, ".");
    const timeoutMs = options.timeoutMs ?? 30000;
    return new Promise((resolveResult, reject) => {
      const child = spawn(command, { cwd, shell: true });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeoutMs);
      child.stdout.on("data", (chunk) => { stdout += String(chunk); });
      child.stderr.on("data", (chunk) => { stderr += String(chunk); });
      child.on("error", reject);
      child.on("close", (code) => {
        clearTimeout(timer);
        resolveResult({
          command,
          stdout: compressOutput(stdout),
          stderr: compressOutput(stderr),
          exitCode: code ?? (timedOut ? 124 : 1),
          timedOut,
          workingDirectory: cwd
        });
      });
    });
  }

  async createPreview(_workspaceId: string, port: number): Promise<{ url: string; port: number; status: "ready" }> {
    return { url: `http://localhost:${port}`, port, status: "ready" };
  }

  private resolveInside(workspaceId: string, filePath: string): string {
    const workspaceRoot = resolve(this.root, workspaceId);
    const target = resolve(workspaceRoot, filePath);
    const rel = relative(workspaceRoot, target);
    if (rel.startsWith("..") || rel === "" && filePath.startsWith("..") || rel.includes(`..${join("/", "")}`)) {
      throw new Error("Path is outside workspace");
    }
    return target;
  }
}

