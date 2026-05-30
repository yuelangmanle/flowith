// ─── Smart Context Window Manager ──────────────────────────────
// Replaces fixed "last 30 messages" with token-aware context building.
// Integrates compression (L1-L3 sync, L4 async) and budget control.

import type { ChatMessage, ProviderConfig, CompressionStats } from "./types";
import type { MemoryStore } from "./memoryKnowledge";
import { queryMemory } from "./memoryKnowledge";
import { getModelContextWindow } from "./types";
import { estimateTokens, estimateMessagesTokens, hashString } from "./tokenCounter";
import { compressContextSync, compressContext, type CompressionOptions } from "./contextCompressor";

// ─── Context Build Options ─────────────────────────────────────

export interface ContextBuildOptions {
  messages: ChatMessage[];
  systemPrompt: string;
  model: string;
  maxOutputTokens?: number;       // reserved for output, default 4096
  overheadTokens?: number;        // reserved for formatting, default 200
  compressionOptions?: CompressionOptions;
  installedSkills?: Array<{ nameZh: string; descriptionZh: string; capabilities?: string[] }>;
  specifiedSkill?: string;
  userQuery?: string;             // for skills relevance matching
  memoryStore?: MemoryStore;      // for memory injection
}

export interface ContextBuildResult {
  messages: Array<{ role: string; content: string; reasoningContent?: string; imageData?: string; additionalImages?: string[]; attachedFiles?: Array<{ name: string; type: string; size: number; content?: string }> }>;
  systemPrompt: string;
  stats: CompressionStats;
  skillsUsed: number;
  totalInputTokens: number;
}

// ─── Skills Context Caching ────────────────────────────────────

interface CachedSkillsContext {
  hash: string;
  context: string;
  skillCount: number;
}

const MAX_SKILLS_CACHE = 100;
const skillsCache = new Map<string, CachedSkillsContext>();

function evictSkillsCacheIfNeeded(): void {
  if (skillsCache.size > MAX_SKILLS_CACHE) {
    // Delete oldest entries (Map maintains insertion order)
    const toDelete = skillsCache.size - MAX_SKILLS_CACHE + 10; // evict 10 extra for headroom
    let deleted = 0;
    for (const key of skillsCache.keys()) {
      if (deleted >= toDelete) break;
      skillsCache.delete(key);
      deleted++;
    }
  }
}

function buildSkillsContext(
  skills: Array<{ nameZh: string; descriptionZh: string; capabilities?: string[] }>,
  query?: string,
  specifiedSkill?: string
): { context: string; count: number } {
  if (!skills || skills.length === 0) return { context: "", count: 0 };

  // Sort by relevance to query if provided
  let sorted = [...skills];
  if (query) {
    const queryLower = query.toLowerCase();
    sorted.sort((a, b) => {
      const aScore = relevanceScore(a, queryLower);
      const bScore = relevanceScore(b, queryLower);
      return bScore - aScore;
    });
  }

  // Top 5 most relevant
  const top = sorted.slice(0, 5);
  const lines = top.map((s) => {
    const caps = s.capabilities ? ` [${s.capabilities.slice(0, 3).join(", ")}]` : "";
    return `- ${s.nameZh}: ${s.descriptionZh.slice(0, 100)}${caps}`;
  });

  let ctx = "";
  if (specifiedSkill) {
    ctx += `\n\n【指定技能】用户要求你使用 "${specifiedSkill}" 技能来完成任务。请优先参考该技能的方法论和最佳实践。`;
  }
  ctx += `\n\n【可用技能】你当前已安装以下技能，在合适的时候可以参考和运用它们的方法论，但不要生搬硬套：\n${lines.join("\n")}`;
  ctx += `\n\n使用原则：\n1. 当任务明显匹配某个技能的使用场景时，自然地运用该技能的方法\n2. 不需要每次都提及技能名称，只需按技能的方法论行事\n3. 如果没有合适的技能，按你自己的专业判断处理\n4. 用户明确指定技能时，优先使用该技能`;

  return { context: ctx, count: top.length };
}

function relevanceScore(
  skill: { nameZh: string; descriptionZh: string; capabilities?: string[] },
  query: string
): number {
  let score = 0;
  const name = skill.nameZh.toLowerCase();
  const desc = skill.descriptionZh.toLowerCase();
  const caps = (skill.capabilities ?? []).join(" ").toLowerCase();

  // Keyword overlap
  const queryWords = query.split(/[\s,，。、]+/).filter(Boolean);
  for (const word of queryWords) {
    if (name.includes(word)) score += 3;
    if (desc.includes(word)) score += 2;
    if (caps.includes(word)) score += 1;
  }
  return score;
}

// ─── Main Context Builder ──────────────────────────────────────

export function buildContextMessages(
  options: ContextBuildOptions
): ContextBuildResult {
  const {
    messages,
    systemPrompt,
    model,
    maxOutputTokens = 4096,
    overheadTokens = 200,
    compressionOptions = {},
    installedSkills,
    specifiedSkill,
    userQuery,
    memoryStore,
  } = options;

  const contextWindow = getModelContextWindow(model);
  const inputBudget = contextWindow - maxOutputTokens - overheadTokens;

  // 1. Build skills context (with caching)
  let fullSystemPrompt = systemPrompt;
  let skillsUsed = 0;

  if (installedSkills && installedSkills.length > 0) {
    const skillsHash = hashString(
      JSON.stringify(installedSkills.map((s) => s.nameZh)) +
      (specifiedSkill ?? "") +
      (userQuery ?? "")
    );

    const cached = skillsCache.get(skillsHash);
    if (cached) {
      fullSystemPrompt += cached.context;
      skillsUsed = cached.skillCount;
    } else {
      const { context, count } = buildSkillsContext(installedSkills, userQuery, specifiedSkill);
      fullSystemPrompt += context;
      skillsUsed = count;
      evictSkillsCacheIfNeeded();
      skillsCache.set(skillsHash, { hash: skillsHash, context, skillCount: count });
    }
  }

  // 3. Inject relevant memories
  if (memoryStore && userQuery) {
    const relevantMemories = queryMemory(memoryStore, userQuery, 5);
    if (relevantMemories.length > 0) {
      const memoryLines = relevantMemories.map((m) => {
        const layerLabel = m.layer === "L3-fact" ? "事实" : m.layer === "L4-episodic" ? "情景" : m.layer === "L1-conversation" ? "对话" : "工作";
        const importance = Math.round(m.importance * 100);
        return `- [${layerLabel}] ${m.content} (重要度: ${importance}%)`;
      });
      fullSystemPrompt += `\n\n【相关记忆】根据你的记忆，以下信息可能与当前任务相关:\n${memoryLines.join("\n")}`;
    }
  }

  const systemTokens = estimateTokens(fullSystemPrompt);

  // 4. Compress history (L1-L3 sync, no L4 for speed)
  const { compressed, stats } = compressContextSync(messages, {
    ...compressionOptions,
    currentTurnIndex: compressionOptions.currentTurnIndex ?? messages.length - 1,
  });

  // 3. Build final message array within budget
  const resultMessages: Array<{ role: string; content: string; reasoningContent?: string; imageData?: string; additionalImages?: string[]; attachedFiles?: Array<{ name: string; type: string; size: number; content?: string }> }> = [];
  let usedTokens = systemTokens;

  // Add system prompt
  resultMessages.push({ role: "system", content: fullSystemPrompt });

  // Walk from newest to oldest, stop when budget exhausted
  for (let i = compressed.length - 1; i >= 0; i--) {
    const msg = compressed[i];
    const content = msg.agentName
      ? `[${msg.agentName}]: ${msg.content}`
      : msg.content;
    const msgTokens = estimateTokens(content) + 4;

    if (usedTokens + msgTokens > inputBudget) {
      // Can't fit this message — stop adding older messages
      break;
    }

    const resultMsg: Record<string, unknown> = {
      role: msg.role === "assistant" ? "assistant" : "user",
      content,
    };
    // Pass reasoningContent back for MiMo/DeepSeek multi-turn compatibility
    if (msg.reasoningContent) resultMsg.reasoningContent = msg.reasoningContent;
    // Pass multimodal data through for vision models
    if (msg.imageData) resultMsg.imageData = msg.imageData;
    if (msg.additionalImages) resultMsg.additionalImages = msg.additionalImages;
    if (msg.attachedFiles) resultMsg.attachedFiles = msg.attachedFiles;
    // Pass multimodal data through for vision models
    if (msg.imageData) resultMsg.imageData = msg.imageData;
    if (msg.additionalImages) resultMsg.additionalImages = msg.additionalImages;
    if (msg.attachedFiles) resultMsg.attachedFiles = msg.attachedFiles;
    resultMessages.splice(1, 0, resultMsg as typeof resultMessages[0]);
    usedTokens += msgTokens;
  }

  return {
    messages: resultMessages,
    systemPrompt: fullSystemPrompt,
    stats,
    skillsUsed,
    totalInputTokens: usedTokens,
  };
}

// ─── Async version with L4 semantic compression ────────────────

export async function buildContextMessagesAsync(
  options: ContextBuildOptions & {
    compressionModel?: { provider: ProviderConfig; model: string };
  }
): Promise<ContextBuildResult> {
  const {
    messages,
    systemPrompt,
    model,
    maxOutputTokens = 4096,
    overheadTokens = 200,
    compressionOptions = {},
    compressionModel,
    installedSkills,
    specifiedSkill,
    userQuery,
    memoryStore,
  } = options;

  const contextWindow = getModelContextWindow(model);
  const inputBudget = contextWindow - maxOutputTokens - overheadTokens;

  // Build skills context
  let fullSystemPrompt = systemPrompt;
  let skillsUsed = 0;

  if (installedSkills && installedSkills.length > 0) {
    const skillsHash = hashString(
      JSON.stringify(installedSkills.map((s) => s.nameZh)) +
      (specifiedSkill ?? "") +
      (userQuery ?? "")
    );
    const cached = skillsCache.get(skillsHash);
    if (cached) {
      fullSystemPrompt += cached.context;
      skillsUsed = cached.skillCount;
    } else {
      const { context, count } = buildSkillsContext(installedSkills, userQuery, specifiedSkill);
      fullSystemPrompt += context;
      skillsUsed = count;
      evictSkillsCacheIfNeeded();
      skillsCache.set(skillsHash, { hash: skillsHash, context, skillCount: count });
    }
  }

  // Inject relevant memories (async version)
  if (memoryStore && userQuery) {
    const relevantMemories = queryMemory(memoryStore, userQuery, 5);
    if (relevantMemories.length > 0) {
      const memoryLines = relevantMemories.map((m) => {
        const layerLabel = m.layer === "L3-fact" ? "事实" : m.layer === "L4-episodic" ? "情景" : m.layer === "L1-conversation" ? "对话" : "工作";
        const importance = Math.round(m.importance * 100);
        return `- [${layerLabel}] ${m.content} (重要度: ${importance}%)`;
      });
      fullSystemPrompt += `\n\n【相关记忆】根据你的记忆，以下信息可能与当前任务相关:\n${memoryLines.join("\n")}`;
    }
  }

  const systemTokens = estimateTokens(fullSystemPrompt);

  // Full compression pipeline (L1-L4)
  const { compressed, stats } = await compressContext(messages, {
    ...compressionOptions,
    enableSemanticCompression: !!compressionModel,
    compressionModel,
    currentTurnIndex: compressionOptions.currentTurnIndex ?? messages.length - 1,
  });

  // Build final message array within budget
  const resultMessages: Array<{ role: string; content: string; reasoningContent?: string; imageData?: string; additionalImages?: string[]; attachedFiles?: Array<{ name: string; type: string; size: number; content?: string }> }> = [];
  let usedTokens = systemTokens;

  resultMessages.push({ role: "system", content: fullSystemPrompt });

  for (let i = compressed.length - 1; i >= 0; i--) {
    const msg = compressed[i];
    const content = msg.agentName
      ? `[${msg.agentName}]: ${msg.content}`
      : msg.content;
    const msgTokens = estimateTokens(content) + 4;

    if (usedTokens + msgTokens > inputBudget) break;

    const resultMsg: Record<string, unknown> = {
      role: msg.role === "assistant" ? "assistant" : "user",
      content,
    };
    // Pass reasoningContent back for MiMo/DeepSeek multi-turn compatibility
    if (msg.reasoningContent) resultMsg.reasoningContent = msg.reasoningContent;
    resultMessages.splice(1, 0, resultMsg as typeof resultMessages[0]);
    usedTokens += msgTokens;
  }

  return {
    messages: resultMessages,
    systemPrompt: fullSystemPrompt,
    stats,
    skillsUsed,
    totalInputTokens: usedTokens,
  };
}

/** Clear the skills cache (e.g., when skills change) */
export function clearSkillsCache(): void {
  skillsCache.clear();
}
