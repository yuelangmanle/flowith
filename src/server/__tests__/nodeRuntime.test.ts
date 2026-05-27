// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NodeWorkspaceRuntime } from "../workspaceRuntime.node";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("node workspace runtime", () => {
  it("creates a real project directory, writes files, runs safe commands, and rejects dangerous commands", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-runtime-"));
    roots.push(root);
    const runtime = new NodeWorkspaceRuntime(root);
    const workspace = await runtime.createWorkspace("ai-resume-optimizer");
    await runtime.writeFile(workspace.id, "README.md", "# AI Resume Optimizer\n");
    await runtime.writeFile(workspace.id, "package.json", "{\"scripts\":{\"dev\":\"vite --host 127.0.0.1\"}}\n");

    const command = await runtime.runCommand(workspace.id, "node -e \"console.log('ok')\"", { approved: true });
    expect(command.exitCode).toBe(0);
    expect(command.stdout).toContain("ok");

    await expect(runtime.runCommand(workspace.id, "rm -rf /", { approved: true })).rejects.toThrow(/dangerous/);
    const preview = await runtime.createPreview(workspace.id, 5173);
    expect(preview.url).toBe("http://localhost:5173");
  });
});

