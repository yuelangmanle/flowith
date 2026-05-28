import { describe, expect, it } from "vitest";
import { createInitialAppState, reduceAppState } from "../appState";

describe("app state", () => {
  it("initializes with default providers and chat view", () => {
    const state = createInitialAppState();
    expect(state.activeView).toBe("chat");
    expect(state.providers.length).toBeGreaterThan(0);
    expect(state.agents.length).toBeGreaterThan(0);
    expect(state.conversations).toBeDefined();
    expect(state.approvals).toEqual([]);
    expect(state.sidebarOpen).toBe(true);
  });

  it("handles view switching", () => {
    let state = createInitialAppState();
    state = reduceAppState(state, { type: "set-view", view: "settings" });
    expect(state.activeView).toBe("settings");
    state = reduceAppState(state, { type: "set-view", view: "roundtable" });
    expect(state.activeView).toBe("roundtable");
  });

  it("handles update-provider action", () => {
    let state = createInitialAppState();
    const provider = { ...state.providers[0], apiKey: "test-key" };
    state = reduceAppState(state, { type: "update-provider", provider });
    expect(state.providers[0].apiKey).toBe("test-key");
  });

  it("handles set-models action", () => {
    let state = createInitialAppState();
    state = reduceAppState(state, { type: "set-models", models: [{ id: "gpt-4", providerId: "openai", name: "gpt-4", capabilities: { chat: true } }] });
    expect(state.models).toHaveLength(1);
  });

  it("handles toggle-sidebar", () => {
    let state = createInitialAppState();
    expect(state.sidebarOpen).toBe(true);
    state = reduceAppState(state, { type: "toggle-sidebar" });
    expect(state.sidebarOpen).toBe(false);
    state = reduceAppState(state, { type: "toggle-sidebar" });
    expect(state.sidebarOpen).toBe(true);
  });
});
