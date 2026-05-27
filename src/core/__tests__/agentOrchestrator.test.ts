import { describe, expect, it } from "vitest";
import { runProjectGeneration, runRoundtable } from "../agentOrchestrator";

describe("agent orchestrator", () => {
  it("runs the full deterministic project generation flow", async () => {
    const run = await runProjectGeneration({
      idea: "Build an AI resume optimization web app.",
      stackOverride: "Vite + React + TypeScript",
      confirmPlan: true,
      approveDangerousActions: true
    });
    expect(run.clarifyingQuestions).toHaveLength(4);
    expect(run.stack.status).toBe("official");
    expect(run.agents.map((agent) => agent.role)).toEqual([
      "product",
      "architecture",
      "development",
      "ui",
      "testing",
      "documentation",
      "review"
    ]);
    expect(run.approvals.map((approval) => approval.type)).toEqual(["install-dependency", "execute-command"]);
    expect(run.artifacts.some((artifact) => artifact.kind === "readme")).toBe(true);
    expect(run.memoryItems.length).toBeGreaterThan(0);
    expect(run.knowledgeSources[0].metadata.sourceUrl).toContain("vitejs.dev");
    expect(run.preview.url).toContain("localhost");
    expect(run.fixLoopCount).toBe(1);
  });

  it("runs a roundtable and converts accepted conclusion to memory", () => {
    const result = runRoundtable({
      topic: "如何改进 AI 简历优化工具",
      rounds: 3,
      accepted: true
    });
    expect(result.messages.length).toBeGreaterThanOrEqual(3);
    expect(result.summary).toContain("结论");
    expect(result.memoryItems[0].type).toBe("scenario");
  });
});

