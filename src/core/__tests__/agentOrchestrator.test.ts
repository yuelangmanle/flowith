import { describe, expect, it } from "vitest";
import { createOrchestrationPlan } from "../agentOrchestrator";
import { createRoundtable, createVoteSession, castVote, closeVote, getVoteResults, generateReport } from "../roundtable";
import { createCodeGenRun, getPhaseDefinition, getAllPhases } from "../codeGeneration";
import { DEFAULT_AGENTS } from "../agentConfig";

describe("orchestration plan", () => {
  it("creates a sequential plan", () => {
    const plan = createOrchestrationPlan("sequential", "Build a TODO app", ["agent-product", "agent-developer"]);
    expect(plan.mode).toBe("sequential");
    expect(plan.status).toBe("pending");
    expect(plan.agentIds).toHaveLength(2);
  });

  it("creates a hierarchical plan", () => {
    const plan = createOrchestrationPlan("hierarchical", "Design system", ["agent-moderator", "agent-arch"]);
    expect(plan.mode).toBe("hierarchical");
  });
});

describe("roundtable", () => {
  it("creates roundtable with agents", () => {
    const agents = DEFAULT_AGENTS.slice(0, 3);
    const state = createRoundtable("Web performance", agents, 3);
    expect(state.topic).toBe("Web performance");
    expect(state.agents).toHaveLength(3);
    expect(state.maxRounds).toBe(3);
    expect(state.status).toBe("idle");
  });

  it("generates a report from roundtable state", () => {
    const agents = DEFAULT_AGENTS.slice(0, 2);
    const state = createRoundtable("Test topic", agents, 1);
    state.conversation.messages.push({
      id: "msg-1",
      role: "assistant",
      content: "I think we should optimize bundle size first.",
      agentId: agents[0].id,
      agentName: agents[0].name,
      agentColor: agents[0].color,
      createdAt: new Date().toISOString(),
    });
    const report = generateReport(state);
    expect(report.title).toContain("Test topic");
    expect(report.sections.length).toBeGreaterThanOrEqual(2);
    expect(report.conclusion).toBeTruthy();
  });
});

describe("voting", () => {
  it("creates vote session and casts votes", () => {
    const session = createVoteSession("Best approach?", ["Option A", "Option B", "Option C"], "conv-1");
    expect(session.options).toHaveLength(3);
    expect(session.status).toBe("active");

    const afterVote1 = castVote(session, "opt-0", "agent-1");
    const afterVote2 = castVote(afterVote1, "opt-0", "agent-2");
    const afterVote3 = castVote(afterVote2, "opt-1", "agent-3");

    const closed = closeVote(afterVote3);
    expect(closed.status).toBe("closed");

    const results = getVoteResults(closed);
    expect(results.totalVotes).toBe(3);
    expect(results.winner?.id).toBe("opt-0");
  });
});

describe("code generation", () => {
  it("creates a code gen run", () => {
    const run = createCodeGenRun("proj-1", "Build a chat app", "Vite + React");
    expect(run.phase).toBe("requirements");
    expect(run.status).toBe("running");
    expect(run.fixAttempts).toBe(0);
  });

  it("defines all phases", () => {
    const phases = getAllPhases();
    expect(phases.length).toBeGreaterThanOrEqual(7);
    expect(phases[0].phase).toBe("requirements");
    expect(phases[phases.length - 1].phase).toBe("completed");
  });

  it("gets phase definition", () => {
    const def = getPhaseDefinition("requirements");
    expect(def?.name).toBe("需求分析");
    expect(def?.agentRole).toBe("product");
  });
});
