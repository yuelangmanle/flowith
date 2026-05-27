import { describe, expect, it } from "vitest";
import { createInitialAppState, reduceAppState } from "../appState";

describe("app state", () => {
  it("runs demo generation, approval, provider refresh, and roundtable state transitions", () => {
    let state = createInitialAppState();
    expect(state.activeView).toBe("workspace");
    state = reduceAppState(state, { type: "run-demo" });
    expect(state.currentRun?.status).toBe("waiting-for-approval");
    expect(state.approvals.length).toBeGreaterThan(0);
    state = reduceAppState(state, { type: "approve-next" });
    expect(state.approvals[0]?.status).toBe("approved");
    state = reduceAppState(state, { type: "refresh-provider", providerId: "ollama", modelCount: 2 });
    expect(state.providers.find((provider) => provider.id === "ollama")?.modelsDiscovered).toBe(2);
    state = reduceAppState(state, { type: "start-roundtable" });
    expect(state.roundtable?.summary).toContain("结论");
  });
});
