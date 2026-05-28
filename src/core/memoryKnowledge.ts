import type { KnowledgeSource, MemoryItem, MemoryType, MemoryLayer, SourceRef } from "./types";

// ─── Memory Store ───────────────────────────────────────────────

export interface MemoryStore {
  items: MemoryItem[];
  l1Buffer: MemoryItem[];  // 对话记忆 - 短期
  l2Buffer: MemoryItem[];  // 工作记忆 - 任务级
}

export interface KnowledgeBase {
  sources: KnowledgeSource[];
}

export function createMemoryStore(): MemoryStore {
  return { items: [], l1Buffer: [], l2Buffer: [] };
}

export function createKnowledgeBase(): KnowledgeBase {
  return { sources: [] };
}

// ─── L1: Conversation Memory (短期, 内存) ───────────────────────

export function addToL1(store: MemoryStore, content: string, source: SourceRef): MemoryItem {
  const item = createMemoryItem({
    type: "raw",
    layer: "L1-conversation",
    content,
    source,
    importance: 0.3,
    retention: "expire",
  });
  store.l1Buffer.push(item);
  // L1 只保留最近 50 条
  if (store.l1Buffer.length > 50) {
    store.l1Buffer = store.l1Buffer.slice(-50);
  }
  return item;
}

export function getL1Context(store: MemoryStore, maxItems: number = 10): string {
  return store.l1Buffer
    .slice(-maxItems)
    .map((m) => m.content)
    .join("\n");
}

// ─── L2: Working Memory (任务级, 内存) ──────────────────────────

export function addToL2(store: MemoryStore, content: string, source: SourceRef, tags: string[] = []): MemoryItem {
  const item = createMemoryItem({
    type: "scenario",
    layer: "L2-working",
    content,
    source,
    importance: 0.5,
    retention: "expire",
    tags,
  });
  store.l2Buffer.push(item);
  if (store.l2Buffer.length > 30) {
    store.l2Buffer = store.l2Buffer.slice(-30);
  }
  return item;
}

export function getL2Context(store: MemoryStore, tags?: string[]): string {
  let items = store.l2Buffer;
  if (tags && tags.length > 0) {
    items = items.filter((m) => tags.some((t) => m.tags.includes(t)));
  }
  return items.map((m) => `[${m.tags.join(",")}] ${m.content}`).join("\n");
}

// ─── L3: Fact Memory (长期, 持久化) ─────────────────────────────

export function addFact(
  store: MemoryStore,
  content: string,
  source: SourceRef,
  confirmed: boolean = false
): MemoryItem {
  const item = createMemoryItem({
    type: "fact",
    layer: "L3-fact",
    content,
    source,
    importance: 0.8,
    retention: "keep",
    confirmed,
    scope: "global",
  });
  store.items.push(item);
  return item;
}

export function queryFacts(store: MemoryStore, query: string): MemoryItem[] {
  const tokens = tokenize(query);
  return store.items
    .filter((m) => m.layer === "L3-fact")
    .map((m) => ({ item: m, score: scoreMemory(m, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}

// ─── L4: Episodic Memory (情景记忆, 持久化) ─────────────────────

export function addEpisode(
  store: MemoryStore,
  content: string,
  source: SourceRef,
  tags: string[] = []
): MemoryItem {
  const item = createMemoryItem({
    type: "scenario",
    layer: "L4-episodic",
    content,
    source,
    importance: 0.6,
    retention: "keep",
    tags,
    scope: "project",
  });
  store.items.push(item);
  return item;
}

export function queryEpisodes(store: MemoryStore, query: string, limit: number = 5): MemoryItem[] {
  const tokens = tokenize(query);
  return store.items
    .filter((m) => m.layer === "L4-episodic")
    .map((m) => ({ item: m, score: scoreMemory(m, tokens) + timeDecay(m) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.item);
}

// ─── Unified Memory Query ───────────────────────────────────────

export function queryMemory(store: MemoryStore, query: string, limit: number = 10): MemoryItem[] {
  const tokens = tokenize(query);
  const allItems = [...store.l1Buffer, ...store.l2Buffer, ...store.items];

  return allItems
    .map((m) => ({
      item: m,
      score: scoreMemory(m, tokens) + timeDecay(m) + importanceBoost(m),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => {
      r.item.lastUsedAt = new Date().toISOString();
      return r.item;
    });
}

// ─── Memory Consolidation ───────────────────────────────────────

export function shouldWriteLongTermMemory(event: {
  kind: string;
  accepted?: boolean;
  explicitRemember?: boolean;
}): boolean {
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
    importance?: number;
    tags?: string[];
  }
): MemoryItem {
  const item = createMemoryItem({
    type: input.type,
    layer: input.type === "fact" ? "L3-fact" : "L4-episodic",
    content: input.content,
    source: input.source,
    importance: input.importance ?? 0.7,
    retention: "keep",
    confirmed: input.confirmed ?? false,
    scope: input.scope ?? "project",
    confidence: input.confidence ?? 0.85,
    tags: input.tags ?? [],
  });
  store.items.push(item);
  return item;
}

// ─── Knowledge Base ─────────────────────────────────────────────

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

// ─── Helpers ────────────────────────────────────────────────────

function createMemoryItem(input: {
  type: MemoryType;
  layer: MemoryLayer;
  content: string;
  source: SourceRef;
  importance: number;
  retention: "keep" | "expire" | "delete";
  confirmed?: boolean;
  scope?: "project" | "global";
  confidence?: number;
  tags?: string[];
}): MemoryItem {
  return {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: input.type,
    layer: input.layer,
    content: input.content,
    confidence: input.confidence ?? 0.85,
    source: input.source,
    createdAt: new Date().toISOString(),
    confirmed: input.confirmed ?? false,
    scope: input.scope ?? "project",
    retention: input.retention,
    importance: input.importance,
    tags: input.tags ?? [],
  };
}

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5/.-]+/).filter(Boolean);
}

function scoreMemory(item: MemoryItem, tokens: string[]): number {
  const haystack = `${item.content} ${item.tags.join(" ")}`.toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0);
}

function scoreSource(source: KnowledgeSource, tokens: string[]): number {
  const haystack = `${source.title} ${source.content} ${source.metadata.sourceUrl ?? ""}`.toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0);
}

function timeDecay(item: MemoryItem): number {
  const age = Date.now() - new Date(item.createdAt).getTime();
  const dayInMs = 86400000;
  // 7 天内衰减很小，之后逐渐衰减
  return Math.max(0, 1 - age / (30 * dayInMs));
}

function importanceBoost(item: MemoryItem): number {
  return item.importance * 0.5;
}
