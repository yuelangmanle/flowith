import type { KnowledgeSource, MemoryItem, MemoryType, MemoryLayer, SourceRef, MemoryStats } from "./types";

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

// ─── Stop Words ─────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "的", "了", "是", "在", "我", "有", "和", "就", "不", "人", "都", "一", "一个",
  "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好",
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "must",
  "it", "its", "this", "that", "these", "those", "i", "you", "he", "she",
  "we", "they", "me", "him", "her", "us", "them", "my", "your", "his",
  "and", "or", "but", "if", "then", "so", "for", "of", "to", "in", "on",
  "at", "by", "with", "from", "as", "into", "about", "between", "through",
  "after", "before", "above", "below", "up", "down", "out", "off",
]);

// ─── Tokenizer & Keywords ───────────────────────────────────────

export function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(Boolean);
}

export function extractKeywords(text: string): string[] {
  const tokens = tokenize(text);
  return tokens.filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

function isCJK(char: string): boolean {
  const code = char.charCodeAt(0);
  return (code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf);
}

// ─── Jaccard Similarity ─────────────────────────────────────────

export function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(extractKeywords(a));
  const tokensB = new Set(extractKeywords(b));
  if (tokensA.size === 0 && tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// ─── Find Similar Memories ──────────────────────────────────────

export function findSimilarMemories(
  store: MemoryStore,
  content: string,
  threshold: number = 0.4
): MemoryItem[] {
  const allItems = [...store.l1Buffer, ...store.l2Buffer, ...store.items];
  return allItems
    .map(m => ({ item: m, similarity: jaccardSimilarity(content, m.content) }))
    .filter(r => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .map(r => r.item);
}

// ─── Scoring ────────────────────────────────────────────────────

function scoreMemory(item: MemoryItem, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  // Jaccard score (0-1)
  const itemTokens = new Set(extractKeywords(item.content + " " + item.tags.join(" ")));
  let intersection = 0;
  for (const t of queryTokens) {
    if (itemTokens.has(t)) intersection++;
  }
  const union = new Set([...queryTokens, ...itemTokens]).size;
  const jaccardScore = union > 0 ? intersection / union : 0;

  // Keyword weight score (0-1) — exact substring matches
  const haystack = `${item.content} ${item.tags.join(" ")}`.toLowerCase();
  let keywordHits = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) keywordHits++;
  }
  const keywordScore = queryTokens.length > 0 ? keywordHits / queryTokens.length : 0;

  // Time decay (0-1) — 30 days
  const age = Date.now() - new Date(item.createdAt).getTime();
  const dayInMs = 86400000;
  const timeDecay = Math.max(0, 1 - age / (30 * dayInMs));

  // Importance boost (0-0.5)
  const importanceBoost = item.importance * 0.5;

  // Hit count boost (0-0.2)
  const hitBoost = Math.min(0.2, (item.hitCount ?? 0) * 0.02);

  return jaccardScore * 0.4 + keywordScore * 0.3 + timeDecay * 0.2 + importanceBoost * 0.1 + hitBoost;
}

function scoreSource(source: KnowledgeSource, tokens: string[]): number {
  const haystack = `${source.title} ${source.content} ${source.metadata.sourceUrl ?? ""}`.toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0);
}

// ─── L1: Conversation Memory (短期, 内存) ───────────────────────

export function addToL1(store: MemoryStore, content: string, source: SourceRef, opts?: { conversationId?: string; messageId?: string }): MemoryItem {
  const item = createMemoryItem({
    type: "raw",
    layer: "L1-conversation",
    content,
    source,
    importance: 0.3,
    retention: "expire",
    sourceConversationId: opts?.conversationId,
    sourceMessageId: opts?.messageId,
  });
  store.l1Buffer.push(item);
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

export function addToL2(store: MemoryStore, content: string, source: SourceRef, tags: string[] = [], opts?: { conversationId?: string; messageId?: string; importance?: number }): MemoryItem {
  const item = createMemoryItem({
    type: "scenario",
    layer: "L2-working",
    content,
    source,
    importance: opts?.importance ?? 0.5,
    retention: "expire",
    tags,
    sourceConversationId: opts?.conversationId,
    sourceMessageId: opts?.messageId,
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
  confirmed: boolean = false,
  opts?: { conversationId?: string; messageId?: string; tags?: string[]; importance?: number }
): MemoryItem {
  // Dedup check
  const similar = findSimilarMemories(store, content, 0.7);
  const existingL3 = similar.find(m => m.layer === "L3-fact");
  if (existingL3) {
    // Merge: update existing
    existingL3.content = content;
    existingL3.updatedAt = new Date().toISOString();
    existingL3.version = (existingL3.version ?? 1) + 1;
    existingL3.confirmed = confirmed || existingL3.confirmed;
    existingL3.lastUsedAt = new Date().toISOString();
    if (opts?.tags) existingL3.tags = [...new Set([...existingL3.tags, ...opts.tags])];
    return existingL3;
  }

  const item = createMemoryItem({
    type: "fact",
    layer: "L3-fact",
    content,
    source,
    importance: opts?.importance ?? 0.8,
    retention: "keep",
    confirmed,
    scope: "global",
    tags: opts?.tags ?? [],
    sourceConversationId: opts?.conversationId,
    sourceMessageId: opts?.messageId,
  });

  // Link to related memories (0.4-0.7 similarity)
  const related = similar.filter(m => m.id !== item.id).slice(0, 5);
  if (related.length > 0) {
    item.relatedIds = related.map(m => m.id);
    for (const r of related) {
      if (!r.relatedIds) r.relatedIds = [];
      if (!r.relatedIds.includes(item.id)) r.relatedIds.push(item.id);
    }
  }

  store.items.push(item);
  return item;
}

export function queryFacts(store: MemoryStore, query: string): MemoryItem[] {
  const tokens = extractKeywords(query);
  return store.items
    .filter((m) => m.layer === "L3-fact")
    .map((m) => ({ item: m, score: scoreMemory(m, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => {
      r.item.hitCount = (r.item.hitCount ?? 0) + 1;
      r.item.lastUsedAt = new Date().toISOString();
      return r.item;
    });
}

// ─── L4: Episodic Memory (情景记忆, 持久化) ─────────────────────

export function addEpisode(
  store: MemoryStore,
  content: string,
  source: SourceRef,
  tags: string[] = [],
  opts?: { conversationId?: string; messageId?: string; importance?: number }
): MemoryItem {
  // Dedup check
  const similar = findSimilarMemories(store, content, 0.7);
  const existingL4 = similar.find(m => m.layer === "L4-episodic");
  if (existingL4) {
    existingL4.content = content;
    existingL4.updatedAt = new Date().toISOString();
    existingL4.version = (existingL4.version ?? 1) + 1;
    existingL4.lastUsedAt = new Date().toISOString();
    return existingL4;
  }

  const item = createMemoryItem({
    type: "scenario",
    layer: "L4-episodic",
    content,
    source,
    importance: opts?.importance ?? 0.6,
    retention: "keep",
    tags,
    scope: "project",
    sourceConversationId: opts?.conversationId,
    sourceMessageId: opts?.messageId,
  });

  const related = similar.filter(m => m.id !== item.id).slice(0, 5);
  if (related.length > 0) {
    item.relatedIds = related.map(m => m.id);
    for (const r of related) {
      if (!r.relatedIds) r.relatedIds = [];
      if (!r.relatedIds.includes(item.id)) r.relatedIds.push(item.id);
    }
  }

  store.items.push(item);
  return item;
}

export function queryEpisodes(store: MemoryStore, query: string, limit: number = 5): MemoryItem[] {
  const tokens = extractKeywords(query);
  return store.items
    .filter((m) => m.layer === "L4-episodic")
    .map((m) => ({ item: m, score: scoreMemory(m, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => {
      r.item.hitCount = (r.item.hitCount ?? 0) + 1;
      r.item.lastUsedAt = new Date().toISOString();
      return r.item;
    });
}

// ─── Unified Memory Query ───────────────────────────────────────

export function queryMemory(store: MemoryStore, query: string, limit: number = 10): MemoryItem[] {
  const tokens = extractKeywords(query);
  const allItems = [...store.l1Buffer, ...store.l2Buffer, ...store.items];

  return allItems
    .map((m) => ({
      item: m,
      score: scoreMemory(m, tokens),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => {
      r.item.hitCount = (r.item.hitCount ?? 0) + 1;
      r.item.lastUsedAt = new Date().toISOString();
      return r.item;
    });
}

// ─── Memory Consolidation (判断是否值得写入) ─────────────────────

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

// ─── Write Memory (with dedup) ──────────────────────────────────

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
    sourceConversationId?: string;
    sourceMessageId?: string;
  }
): MemoryItem {
  // Dedup: check similar memories
  const similar = findSimilarMemories(store, input.content, 0.7);
  const existing = similar.find(m => m.layer === (input.type === "fact" ? "L3-fact" : "L4-episodic"));
  if (existing) {
    existing.content = input.content;
    existing.updatedAt = new Date().toISOString();
    existing.version = (existing.version ?? 1) + 1;
    existing.confirmed = input.confirmed ?? existing.confirmed;
    existing.lastUsedAt = new Date().toISOString();
    if (input.tags) existing.tags = [...new Set([...existing.tags, ...input.tags])];
    return existing;
  }

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
    sourceConversationId: input.sourceConversationId,
    sourceMessageId: input.sourceMessageId,
  });

  // Link related
  const related = similar.filter(m => m.id !== item.id).slice(0, 5);
  if (related.length > 0) {
    item.relatedIds = related.map(m => m.id);
    for (const r of related) {
      if (!r.relatedIds) r.relatedIds = [];
      if (!r.relatedIds.includes(item.id)) r.relatedIds.push(item.id);
    }
  }

  store.items.push(item);
  return item;
}

// ─── Lifecycle Management ───────────────────────────────────────

export function evictExpiredMemories(store: MemoryStore): number {
  let evicted = 0;
  const now = Date.now();
  const dayInMs = 86400000;

  // L3/L4: mark low-importance items for deletion if over limit
  const longTerm = store.items;
  if (longTerm.length > 500) {
    const sorted = [...longTerm].sort((a, b) => a.importance - b.importance);
    const toEvict = sorted.slice(0, longTerm.length - 500);
    for (const item of toEvict) {
      item.retention = "delete";
      evicted++;
    }
  }

  // Remove items marked for deletion
  const beforeCount = store.items.length;
  store.items = store.items.filter(m => m.retention !== "delete");
  evicted += beforeCount - store.items.length;

  // Decay importance for old unused memories
  for (const item of store.items) {
    if (item.lastUsedAt) {
      const age = now - new Date(item.lastUsedAt).getTime();
      if (age > 30 * dayInMs) {
        item.importance = Math.max(0.1, item.importance - 0.05);
      }
    }
  }

  return evicted;
}

export function getMemoryStats(store: MemoryStore): MemoryStats {
  const now = Date.now();
  const sevenDaysMs = 7 * 86400000;
  const allItems = [...store.l1Buffer, ...store.l2Buffer, ...store.items];
  const recentAdditions = allItems.filter(m => now - new Date(m.createdAt).getTime() < sevenDaysMs).length;
  const totalHits = allItems.reduce((sum, m) => sum + (m.hitCount ?? 0), 0);

  return {
    totalItems: allItems.length,
    l1Count: store.l1Buffer.length,
    l2Count: store.l2Buffer.length,
    l3Count: store.items.filter(m => m.layer === "L3-fact").length,
    l4Count: store.items.filter(m => m.layer === "L4-episodic").length,
    recentAdditions,
    totalHits,
  };
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
  sourceConversationId?: string;
  sourceMessageId?: string;
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
    version: 1,
    hitCount: 0,
    sourceConversationId: input.sourceConversationId,
    sourceMessageId: input.sourceMessageId,
  };
}
