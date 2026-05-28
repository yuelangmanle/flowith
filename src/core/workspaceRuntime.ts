import type { ToolCallRecord } from "./types";
import { isDangerousCommand, compressOutput } from "./toolRuntime";

export type ToolAction =
  | { type: "write-file"; path: string }
  | { type: "install-dependency"; command: string }
  | { type: "execute-command"; command: string }
  | { type: "network"; url: string }
  | { type: "delete-file"; path: string }
  | { type: "database-migration"; command: string }
  | { type: "sensitive-read"; path: string };

export function needsApproval(action: ToolAction): boolean {
  return action.type !== "write-file";
}

export { isDangerousCommand };

export function createWorkspaceRuntime(id: string) {
  const files = new Map<string, string>();
  const toolCalls: ToolCallRecord[] = [];
  const assertSafePath = (path: string) => {
    if (path.startsWith("/") || path.includes("..")) throw new Error("Path is outside workspace");
  };

  return {
    id, files, toolCalls,
    writeFile(path: string, content: string): ToolCallRecord {
      assertSafePath(path);
      files.set(path, content);
      const call = makeToolCall({ type: "write-file", path, status: "completed", workingDirectory: id });
      toolCalls.push(call);
      return call;
    },
    readFile(path: string): string {
      assertSafePath(path);
      return files.get(path) ?? "";
    },
    recordCommand(input: { command: string; approved: boolean; stdout: string; stderr: string; exitCode: number }): ToolCallRecord {
      if (!input.approved || needsApproval({ type: "execute-command", command: input.command })) {
        if (!input.approved) {
          const call = makeToolCall({ type: "execute-command", command: input.command, status: "approval-required", workingDirectory: id });
          toolCalls.push(call);
          return call;
        }
      }
      if (isDangerousCommand(input.command)) throw new Error("Dangerous command blocked");
      const call = makeToolCall({
        type: "execute-command", command: input.command,
        status: input.exitCode === 0 ? "completed" : "failed",
        stdout: compressOutput(input.stdout), stderr: compressOutput(input.stderr),
        exitCode: input.exitCode, workingDirectory: id,
      });
      toolCalls.push(call);
      return call;
    },
  };
}

function makeToolCall(input: Partial<ToolCallRecord> & Pick<ToolCallRecord, "type" | "status" | "workingDirectory">): ToolCallRecord {
  return {
    id: `tool-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: input.type, path: input.path, command: input.command,
    status: input.status, stdout: input.stdout, stderr: input.stderr,
    exitCode: input.exitCode, workingDirectory: input.workingDirectory,
    timeoutMs: 30000, createdAt: new Date().toISOString(),
  };
}
