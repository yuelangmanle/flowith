import type { KnowledgeSource, MemoryItem, MemoryType, SourceRef } from "./types";

export interface MemoryStore {
  items: MemoryItem[];
}

export interface KnowledgeBase {
  sources: KnowledgeSource[];
}

export function createMemoryStore(): MemoryStore {
  return { items: [] };
}

export function createKnowledgeBase(): KnowledgeBase {
  return { sources: [] };
}

export function shouldWriteLongTermMemory(event: { kind: string; accepted?: boolean; explicitRemember?: boolean }): boolean {
  if (event.explicitRemember) return true;
  if (event.kind === "casual-chat") return false;
  if (event.kind === "roundtable-conclusion") return event.accepted === true;
  return ["project-decision", "technical-experience", "api-research", "user-preference"].includes(event.kind);
}

export function writeMemory(
  store: MemoryStore,
  input: {
    type: MemoryType;
    content: string;
    source: SourceRef;
    confirmed?: boolean;
    scope?: "project" | "global";
    confidence?: number;
  }
): MemoryItem {
  const item: MemoryItem = {
    id: `mem-${store.items.length + 1}`,
    type: input.type,
    content: input.content,
    confidence: input.confidence ?? 0.85,
    source: input.source,
    createdAt: new Date().toISOString(),
    confirmed: input.confirmed ?? false,
    scope: input.scope ?? "project",
    retention: "keep"
  };
  store.items.push(item);
  return item;
}

export function upsertKnowledgeSource(base: KnowledgeBase, source: KnowledgeSource): KnowledgeSource {
  const existingIndex = base.sources.findIndex((item) => item.id === source.id);
  if (existingIndex >= 0) base.sources[existingIndex] = source;
  else base.sources.push(source);
  return source;
}

export function queryKnowledge(
  base: KnowledgeBase,
  query: string,
  filters: { projectId?: string; kind?: KnowledgeSource["kind"] } = {}
): KnowledgeSource[] {
  const tokens = tokenize(query);
  return base.sources
    .filter((source) => !filters.projectId || source.metadata.projectId === filters.projectId)
    .filter((source) => !filters.kind || source.kind === filters.kind)
    .map((source) => ({ source, score: scoreSource(source, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.source);
}

function scoreSource(source: KnowledgeSource, tokens: string[]): number {
  const haystack = `${source.title} ${source.content} ${source.metadata.sourceUrl ?? ""}`.toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0);
}

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5/.-]+/).filter(Boolean);
}

