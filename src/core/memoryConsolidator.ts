import type { MemoryItem } from "./types";
import type { MemoryStore } from "./memoryKnowledge";
import { extractKeywords, findSimilarMemories, jaccardSimilarity } from "./memoryKnowledge";

// ─── Memory Consolidator ────────────────────────────────────────
// Rule-driven consolidation: promote short-term memories to long-term
// based on frequency, importance, and explicit user confirmation.

export interface ConsolidationResult {
  promoted: number;      // L1/L2 → L3/L4
  merged: number;        // duplicate memories merged
  evicted: number;       // expired memories removed
  keywordClusters: number; // keyword clusters found
}

// ─── Main Consolidation Pipeline ────────────────────────────────

export function consolidateMemories(store: MemoryStore): ConsolidationResult {
  let promoted = 0;
  let merged = 0;
  const now = new Date().toISOString();

  // Step 1: Scan L1 buffer, cluster by keywords, promote frequent clusters
  const l1Clusters = clusterByKeywords(store.l1Buffer);
  for (const [keyword, items] of l1Clusters) {
    if (items.length >= 3) {
      // Merge cluster into a single L3 fact
      const mergedContent = mergeClusterContent(items);
      const existingSimilar = findSimilarMemories(store, mergedContent, 0.7);
      const existingL3 = existingSimilar.find(m => m.layer === "L3-fact");

      if (existingL3) {
        // Update existing L3
        existingL3.content = mergedContent;
        existingL3.updatedAt = now;
        existingL3.version = (existingL3.version ?? 1) + 1;
        existingL3.lastUsedAt = now;
        merged++;
      } else {
        // Create new L3
        const avgImportance = items.reduce((s, m) => s + m.importance, 0) / items.length;
        store.items.push({
          id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: "fact",
          layer: "L3-fact",
          content: mergedContent,
          confidence: 0.8,
          source: items[0].source,
          createdAt: now,
          confirmed: false,
          scope: "global",
          retention: "keep",
          importance: Math.max(0.6, avgImportance),
          tags: [...new Set(items.flatMap(m => m.tags))],
          version: 1,
          hitCount: 0,
          sourceConversationId: items[0].sourceConversationId,
        });
      }

      // Remove promoted L1 items
      const promotedIds = new Set(items.map((m: MemoryItem) => m.id));
      store.l1Buffer = store.l1Buffer.filter((m: MemoryItem) => !promotedIds.has(m.id));
      promoted++;
    }
  }

  // Step 2: Scan L2 buffer, promote high-importance items
  const highImportanceL2 = store.l2Buffer.filter((m: MemoryItem) => m.importance > 0.7);
  for (const item of highImportanceL2) {
    const existingSimilar = findSimilarMemories(store, item.content, 0.7);
    const existing = existingSimilar.find(m => m.layer === "L3-fact" || m.layer === "L4-episodic");

    if (existing) {
      existing.content = item.content;
      existing.updatedAt = now;
      existing.version = (existing.version ?? 1) + 1;
      existing.lastUsedAt = now;
      merged++;
    } else {
      // Promote to L3 or L4 based on type
      const targetLayer = item.type === "scenario" ? "L4-episodic" : "L3-fact";
      store.items.push({
        ...item,
        layer: targetLayer,
        retention: "keep",
        updatedAt: now,
        version: (item.version ?? 1) + 1,
      });
    }

    // Remove from L2
    store.l2Buffer = store.l2Buffer.filter(m => m.id !== item.id);
    promoted++;
  }

  // Step 3: Evict expired memories
  let evicted = 0;
  const longTerm = store.items;
  if (longTerm.length > 500) {
    const sorted = [...longTerm].sort((a, b) => {
      const scoreA = a.importance + (a.hitCount ?? 0) * 0.01;
      const scoreB = b.importance + (b.hitCount ?? 0) * 0.01;
      return scoreA - scoreB;
    });
    const toRemove = sorted.slice(0, longTerm.length - 500);
    const removeIds = new Set(toRemove.map((m: MemoryItem) => m.id));
    store.items = store.items.filter(m => !removeIds.has(m.id));
    evicted = toRemove.length;
  }

  return {
    promoted,
    merged,
    evicted,
    keywordClusters: l1Clusters.size,
  };
}

// ─── Keyword Clustering ─────────────────────────────────────────

function clusterByKeywords(memories: MemoryItem[]): Map<string, MemoryItem[]> {
  const clusters = new Map<string, MemoryItem[]>();

  for (const mem of memories) {
    const keywords = extractKeywords(mem.content);
    for (const kw of keywords) {
      if (kw.length < 2) continue;
      if (!clusters.has(kw)) clusters.set(kw, []);
      clusters.get(kw)!.push(mem);
    }
  }

  // Only keep clusters with 2+ items
  for (const [key, items] of clusters) {
    if (items.length < 2) clusters.delete(key);
  }

  return clusters;
}

function mergeClusterContent(items: MemoryItem[]): string {
  // Take the most informative content from the cluster
  const sorted = [...items].sort((a, b) => {
    const scoreA = a.content.length + a.importance * 100;
    const scoreB = b.content.length + b.importance * 100;
    return scoreB - scoreA;
  });
  return sorted[0].content;
}

// ─── Capture Memory from Conversation ───────────────────────────

export function shouldCaptureMemory(
  userMessage: string,
  assistantResponse: string
): { capture: boolean; kind: string; importance: number } {
  const combined = (userMessage + " " + assistantResponse).toLowerCase();

  // Explicit remember request
  if (/记住|记一下|remember|save this|别忘了/.test(userMessage)) {
    return { capture: true, kind: "explicit-remember", importance: 0.9 };
  }

  // User preference
  if (/我(喜欢|偏好|习惯|想要|希望|需要)|i (prefer|like|want|need)/i.test(userMessage)) {
    return { capture: true, kind: "user-preference", importance: 0.7 };
  }

  // Technical decision / architecture
  if (/选择|决定|使用|采用|架构|方案|技术栈|框架|数据库|deploy|use .* instead|decide/i.test(combined)) {
    return { capture: true, kind: "project-decision", importance: 0.7 };
  }

  // Code generation / modification
  if (/生成代码|创建.*文件|修改.*代码|重构|refactor|create.*file|implement|build/i.test(combined)) {
    return { capture: true, kind: "technical-experience", importance: 0.5 };
  }

  // Error/bug fix
  if (/错误|bug|fix|修复|报错|error|exception|解决/i.test(combined)) {
    return { capture: true, kind: "technical-experience", importance: 0.6 };
  }

  // Casual chat — don't capture
  if (userMessage.length < 10 && assistantResponse.length < 50) {
    return { capture: false, kind: "casual-chat", importance: 0 };
  }

  return { capture: false, kind: "casual-chat", importance: 0 };
}

export function captureConversationMemory(
  store: MemoryStore,
  userMessage: string,
  assistantResponse: string,
  conversationId?: string,
  messageId?: string
): MemoryItem | null {
  const decision = shouldCaptureMemory(userMessage, assistantResponse);
  if (!decision.capture) return null;

  // Extract the key content to remember
  const content = extractMemoryContent(userMessage, assistantResponse, decision.kind);

  if (decision.kind === "explicit-remember") {
    // Direct to L3 with confirmed=true
    const item: MemoryItem = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: "fact",
      layer: "L3-fact",
      content,
      confidence: 0.95,
      source: {},
      createdAt: new Date().toISOString(),
      confirmed: true,
      scope: "global",
      retention: "keep",
      importance: decision.importance,
      tags: ["user-request"],
      version: 1,
      hitCount: 0,
      sourceConversationId: conversationId,
      sourceMessageId: messageId,
    };
    // Dedup check
    const similar = findSimilarMemories(store, content, 0.7);
    const existing = similar.find(m => m.layer === "L3-fact");
    if (existing) {
      existing.content = content;
      existing.updatedAt = new Date().toISOString();
      existing.version = (existing.version ?? 1) + 1;
      existing.confirmed = true;
      return existing;
    }
    store.items.push(item);
    return item;
  }

  // For other kinds, write to L1 first (will be consolidated later)
  if (decision.importance >= 0.7) {
    // High importance: write directly to L3 (with dedup)
    const similar = findSimilarMemories(store, content, 0.7);
    const existingHigh = similar.find(m => m.layer === "L3-fact");
    if (existingHigh) {
      existingHigh.content = content;
      existingHigh.updatedAt = new Date().toISOString();
      existingHigh.version = (existingHigh.version ?? 1) + 1;
      existingHigh.lastUsedAt = new Date().toISOString();
      return existingHigh;
    }
    const highItem: MemoryItem = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: decision.kind === "user-preference" ? "persona" : "fact",
      layer: "L3-fact",
      content,
      confidence: 0.8,
      source: {},
      createdAt: new Date().toISOString(),
      confirmed: false,
      scope: "global",
      retention: "keep",
      importance: decision.importance,
      tags: [decision.kind],
      version: 1,
      hitCount: 0,
      sourceConversationId: conversationId,
      sourceMessageId: messageId,
    };
    store.items.push(highItem);
    return highItem;
  }

  // Medium importance: write to L1
  const item: MemoryItem = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "raw",
    layer: "L1-conversation",
    content,
    confidence: 0.7,
    source: {},
    createdAt: new Date().toISOString(),
    confirmed: false,
    scope: "project",
    retention: "expire",
    importance: decision.importance,
    tags: [decision.kind],
    version: 1,
    hitCount: 0,
    sourceConversationId: conversationId,
    sourceMessageId: messageId,
  };
  store.l1Buffer.push(item);
  if (store.l1Buffer.length > 50) {
    store.l1Buffer = store.l1Buffer.slice(-50);
  }
  return item;
}

function extractMemoryContent(userMessage: string, assistantResponse: string, kind: string): string {
  switch (kind) {
    case "explicit-remember":
      // Use user's exact words
      return userMessage.replace(/^(记住|记一下|remember|save this|别忘了)[:：\s]*/i, "").trim() || userMessage;
    case "user-preference":
      return `用户偏好: ${userMessage}`;
    case "project-decision":
      // Extract the decision part
      return `决策: ${userMessage.slice(0, 200)}`;
    case "technical-experience":
      return `技术经验: ${userMessage.slice(0, 150)} → ${assistantResponse.slice(0, 150)}`;
    default:
      return userMessage.slice(0, 200);
  }
}
