import { describe, expect, it } from "vitest";
import {
  createMemoryStore,
  createKnowledgeBase,
  shouldWriteLongTermMemory,
  writeMemory,
  addToL1,
  addToL2,
  addFact,
  queryFacts,
  addEpisode,
  queryMemory,
  upsertKnowledgeSource,
  queryKnowledge,
} from "../memoryKnowledge";
import { createIntegrationNote, researchOfficialDocs } from "../docsResearch";

describe("memory layers", () => {
  it("L1 conversation memory is short-term", () => {
    const store = createMemoryStore();
    addToL1(store, "用户问了 React Hooks", { messageId: "msg-1" });
    addToL1(store, "讨论了性能优化", { messageId: "msg-2" });
    expect(store.l1Buffer).toHaveLength(2);
    const context = queryMemory(store, "React");
    expect(context.length).toBeGreaterThan(0);
  });

  it("L2 working memory stores task context", () => {
    const store = createMemoryStore();
    addToL2(store, "正在实现用户认证模块", { runId: "run-1" }, ["auth", "security"]);
    expect(store.l2Buffer).toHaveLength(1);
  });

  it("L3 fact memory supports long-term storage", () => {
    const store = createMemoryStore();
    addFact(store, "项目使用 Vite + React + TypeScript", { runId: "run-1" }, true);
    expect(store.items).toHaveLength(1);
    const facts = queryFacts(store, "Vite React");
    expect(facts).toHaveLength(1);
    expect(facts[0].confirmed).toBe(true);
  });

  it("L4 episodic memory records experiences", () => {
    const store = createMemoryStore();
    addEpisode(store, "首次运行 npm install 失败，需要 Node 18+", { runId: "run-1" }, ["npm", "error"]);
    expect(store.items).toHaveLength(1);
  });

  it("unified memory query searches all layers", () => {
    const store = createMemoryStore();
    addToL1(store, "用户提到 React", { messageId: "msg-1" });
    addToL2(store, "正在开发 React 组件", { runId: "run-1" }, ["react"]);
    addFact(store, "React 是前端框架", { runId: "run-1" });
    const results = queryMemory(store, "React");
    expect(results.length).toBeGreaterThanOrEqual(3);
  });
});

describe("memory write policy", () => {
  it("rejects casual chat for long-term memory", () => {
    expect(shouldWriteLongTermMemory({ kind: "casual-chat" })).toBe(false);
  });

  it("accepts project decisions", () => {
    expect(shouldWriteLongTermMemory({ kind: "project-decision" })).toBe(true);
  });

  it("accepts roundtable conclusions only when accepted", () => {
    expect(shouldWriteLongTermMemory({ kind: "roundtable-conclusion", accepted: true })).toBe(true);
    expect(shouldWriteLongTermMemory({ kind: "roundtable-conclusion", accepted: false })).toBe(false);
  });

  it("always accepts explicit remember requests", () => {
    expect(shouldWriteLongTermMemory({ kind: "casual-chat", explicitRemember: true })).toBe(true);
  });
});

describe("knowledge base", () => {
  it("keeps knowledge separate from memory", () => {
    const kb = createKnowledgeBase();
    upsertKnowledgeSource(kb, {
      id: "docs-openai",
      kind: "official-docs",
      title: "OpenAI Responses API",
      content: "Use Bearer auth and POST /v1/responses.",
      metadata: { projectId: "p1", sourceUrl: "https://platform.openai.com/docs" },
    });
    upsertKnowledgeSource(kb, {
      id: "local-readme",
      kind: "project-doc",
      title: "README",
      content: "This resume app uses Vite and React.",
      metadata: { projectId: "p2" },
    });
    const result = queryKnowledge(kb, "Bearer responses API", { projectId: "p1" });
    expect(result[0].id).toBe("docs-openai");
    expect(result).toHaveLength(1);
  });
});

describe("docs research", () => {
  it("researches official docs and creates integration notes", async () => {
    const finding = await researchOfficialDocs({
      topic: "OpenAI model list",
      url: "https://platform.openai.com/docs/api-reference/models",
      fetcher: async () => new Response("<main>GET /v1/models. Bearer token auth.</main>"),
    });
    expect(finding.requiresApproval).toBe(false);
    expect(finding.official).toBe(true);

    const note = createIntegrationNote({
      service: "OpenAI",
      auth: "Bearer API key",
      endpoint: "GET /v1/models",
      params: "none",
      errorHandling: "Handle 401, 429.",
      rateLimits: "Back off on 429.",
      sdkInstall: "npm install openai",
      minimalExample: "fetch('/v1/models')",
      sources: [finding.citation],
    });
    expect(note).toContain("Auth: Bearer API key");
  });

  it("marks non-official docs as approval-required", async () => {
    const finding = await researchOfficialDocs({
      topic: "random blog",
      url: "https://blog.example.com/api",
      fetcher: async () => new Response("unofficial"),
    });
    expect(finding.requiresApproval).toBe(true);
    expect(finding.official).toBe(false);
  });
});
