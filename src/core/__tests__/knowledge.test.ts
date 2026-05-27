import { describe, expect, it } from "vitest";
import {
  createKnowledgeBase,
  createMemoryStore,
  queryKnowledge,
  shouldWriteLongTermMemory,
  upsertKnowledgeSource,
  writeMemory
} from "../memoryKnowledge";
import { createIntegrationNote, researchOfficialDocs } from "../docsResearch";

describe("memory and knowledge", () => {
  it("writes traceable confirmed memory and rejects casual chat by default", () => {
    const store = createMemoryStore();
    expect(shouldWriteLongTermMemory({ kind: "casual-chat", accepted: false })).toBe(false);
    const item = writeMemory(store, {
      type: "project",
      content: "项目使用 Vite + React + TypeScript。",
      source: { runId: "run-1", messageId: "msg-1", toolCallId: "tool-1" },
      confirmed: true,
      scope: "project"
    });
    expect(item.source.runId).toBe("run-1");
    expect(item.confirmed).toBe(true);
    expect(item.retention).toBe("keep");
  });

  it("keeps knowledge separate from memory and supports metadata-filtered hybrid retrieval", () => {
    const kb = createKnowledgeBase();
    upsertKnowledgeSource(kb, {
      id: "docs-openai",
      kind: "official-docs",
      title: "OpenAI Responses API",
      content: "Use Bearer auth and POST /v1/responses for model calls.",
      metadata: { projectId: "p1", sourceUrl: "https://platform.openai.com/docs/api-reference/responses" }
    });
    upsertKnowledgeSource(kb, {
      id: "local-readme",
      kind: "project-doc",
      title: "README",
      content: "This resume app uses Vite and React.",
      metadata: { projectId: "p2" }
    });
    const result = queryKnowledge(kb, "Bearer responses API", { projectId: "p1" });
    expect(result[0].id).toBe("docs-openai");
    expect(result).toHaveLength(1);
  });

  it("researches official docs and creates complete integration notes", async () => {
    const finding = await researchOfficialDocs({
      topic: "OpenAI model list",
      url: "https://platform.openai.com/docs/api-reference/models",
      fetcher: async () => new Response("<main>GET /v1/models. Bearer token auth. Rate limits apply.</main>")
    });
    expect(finding.requiresApproval).toBe(false);
    expect(finding.citation.url).toContain("platform.openai.com");

    const note = createIntegrationNote({
      service: "OpenAI",
      auth: "Bearer API key",
      endpoint: "GET /v1/models",
      params: "none",
      errorHandling: "Handle 401, 429, and 5xx responses.",
      rateLimits: "Back off on 429.",
      sdkInstall: "npm install openai",
      minimalExample: "fetch('/v1/models')",
      sources: [finding.citation]
    });
    expect(note).toContain("Auth: Bearer API key");
    expect(note).toContain("Sources:");
  });

  it("marks non-official documentation access as approval-required", async () => {
    const finding = await researchOfficialDocs({
      topic: "random blog",
      url: "https://blog.example.com/api",
      fetcher: async () => new Response("unofficial")
    });
    expect(finding.requiresApproval).toBe(true);
  });
});

