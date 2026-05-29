/**
 * API Handlers — Pure function extraction from server/index.ts
 *
 * These handlers can be used by both:
 * - The Node.js HTTP server (desktop)
 * - The DirectApiAdapter (mobile/Capacitor)
 *
 * Each handler takes parsed request data and returns response data.
 * Streaming handlers return an async generator of SSE-formatted events.
 */

import {
  createDefaultProviders,
  discoverModels,
  streamChatCompletion,
  getFallbackModels,
  createDefaultTTSProviders,
  callTTS,
} from "./modelGateway";
import { DEFAULT_AGENTS, createUserAgent, getAgentById } from "./agentConfig";
import {
  createRoundtable,
  runRoundtableDiscussion,
  generateReport,
} from "./roundtable";
import { runSequential, runHierarchical, streamAgentMessage } from "./agentOrchestrator";
import { createMemoryStore, addToL1, addToL2, addFact, queryMemory, writeMemory, getMemoryStats, evictExpiredMemories, findSimilarMemories } from "./memoryKnowledge";
import { captureConversationMemory, consolidateMemories } from "./memoryConsolidator";
import { uid } from "../lib/shared";
import type {
  Conversation,
  ChatMessage,
  ProviderConfig,
  TTSProviderConfig,
  AgentConfig,
  MemoryItem,
  SourceRef,
} from "./types";
import type { RoundtableState } from "./roundtable";
import type { MemoryStore } from "./memoryKnowledge";

// ─── State (shared across handlers) ─────────────────────────────

export interface AppState {
  providers: ProviderConfig[];
  agents: AgentConfig[];
  agentModelConfigs: Array<{ agentId: string; providerId: string; modelId: string; useGlobal?: boolean }>;
  agentTTSConfigs: Array<{ agentId: string; enabled: boolean; ttsProviderId?: string; voice?: string; speed?: number; stylePrompt?: string; model?: string; autoSpeak?: boolean }>;
  conversations: Map<string, Conversation>;
  roundtables: Map<string, RoundtableState>;
  memory: MemoryStore;
  ttsProviders: TTSProviderConfig[];
  installedSkills: Array<{ id: string; name: string; nameZh?: string; description: string; descriptionZh?: string; installed: boolean; capabilities?: string[]; repo?: string; source?: string; stars?: number; [key: string]: unknown }>;
  saveConversations?: () => Promise<void>;
  saveProviders?: () => Promise<void>;
  saveMemory?: () => Promise<void>;
  saveSkills?: () => Promise<void>;
  saveAgents?: () => Promise<void>;
  saveAgentModels?: () => Promise<void>;
  saveAgentTTSConfigs?: () => Promise<void>;
  saveTTSProviders?: () => Promise<void>;
}

export function createAppState(): AppState {
  return {
    providers: createDefaultProviders(),
    agents: [...DEFAULT_AGENTS],
    agentModelConfigs: [],
    agentTTSConfigs: [],
    conversations: new Map(),
    roundtables: new Map(),
    memory: createMemoryStore(),
    ttsProviders: createDefaultTTSProviders(),
    installedSkills: [],
  };
}

function makeSource(conversationId?: string, messageId?: string): SourceRef {
  return { runId: conversationId, messageId };
}

// ─── Non-streaming handlers ─────────────────────────────────────

export function handleHealth(state: AppState) {
  return {
    ok: true,
    providers: state.providers.length,
    agents: state.agents.length,
    conversations: state.conversations.size,
  };
}

export function handleGetProviders(state: AppState) {
  return state.providers;
}

export async function handlePutProviders(state: AppState, body: { providers: ProviderConfig[] }) {
  if (body.providers) state.providers = body.providers;
  await state.saveProviders?.();
  return { ok: true };
}

export function handleGetAgents(state: AppState) {
  return state.agents;
}

export async function handleCreateAgent(state: AppState, body: { name: string; role: string; description?: string; avatar?: string; color?: string }) {
  const agent = createUserAgent({
    name: body.name,
    role: body.role as AgentConfig["role"],
    avatar: body.avatar ?? "🤖",
    goal: body.description ?? "",
    systemPrompt: `你是${body.name}，${body.description ?? body.role}`,
    color: body.color,
  });
  state.agents.push(agent);
  await state.saveAgents?.();
  return agent;
}

export function handleGetConversations(state: AppState) {
  return Array.from(state.conversations.values());
}

export async function handlePutConversations(state: AppState, body: { conversations: Conversation[] }) {
  if (Array.isArray(body.conversations)) {
    state.conversations.clear();
    for (const conv of body.conversations) state.conversations.set(conv.id, conv);
  }
  await state.saveConversations?.();
  return { ok: true };
}

export function handleCreateConversation(state: AppState, body: { type?: string; title?: string; agentIds?: string[] }) {
  const conv: Conversation = {
    id: uid(),
    title: body.title ?? "新对话",
    type: (body.type as Conversation["type"]) ?? "chat",
    agentIds: body.agentIds ?? [],
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.conversations.set(conv.id, conv);
  return conv;
}

export function handleGetAgentModels(state: AppState) {
  return state.agentModelConfigs;
}

export async function handlePutAgentModels(state: AppState, body: { configs: AppState["agentModelConfigs"] }) {
  if (body.configs) state.agentModelConfigs = body.configs;
  await state.saveAgentModels?.();
  return { ok: true };
}

export function handleGetAgentTTSConfigs(state: AppState) {
  return state.agentTTSConfigs;
}

export async function handlePutAgentTTSConfigs(state: AppState, body: { configs: AppState["agentTTSConfigs"] }) {
  if (body.configs) state.agentTTSConfigs = body.configs;
  await state.saveAgentTTSConfigs?.();
  return { ok: true };
}

export function handleGetTTSProviders(state: AppState) {
  return state.ttsProviders;
}

export async function handlePutTTSProviders(state: AppState, body: { providers: TTSProviderConfig[] }) {
  if (body.providers) state.ttsProviders = body.providers;
  await state.saveTTSProviders?.();
  return { ok: true };
}

export function handleGetSkills(state: AppState) {
  return state.installedSkills;
}

export async function handlePutSkills(state: AppState, body: { skills: AppState["installedSkills"] }) {
  if (Array.isArray(body.skills)) state.installedSkills = body.skills;
  await state.saveSkills?.();
  return { ok: true };
}

export function handleGetMemory(state: AppState) {
  return state.memory;
}

export function handleMemoryQuery(state: AppState, body: { query: string; layer?: string; limit?: number }) {
  return queryMemory(state.memory, body.query, body.limit ?? 10);
}

export async function handleMemoryAdd(state: AppState, body: { content: string; layer?: string; importance?: number; tags?: string[]; type?: string; conversationId?: string; messageId?: string }) {
  const layer = body.layer ?? "L1";
  const source = makeSource(body.conversationId, body.messageId);
  if (layer === "L1") {
    addToL1(state.memory, body.content, source, { conversationId: body.conversationId, messageId: body.messageId });
  } else if (layer === "L2") {
    addToL2(state.memory, body.content, source, body.tags ?? [], { conversationId: body.conversationId, messageId: body.messageId, importance: body.importance });
  } else {
    addFact(state.memory, body.content, source, false, { conversationId: body.conversationId, messageId: body.messageId, tags: body.tags, importance: body.importance });
  }
  await state.saveMemory?.();
  return { ok: true };
}

export async function handleMemoryConsolidate(state: AppState) {
  const count = consolidateMemories(state.memory);
  evictExpiredMemories(state.memory);
  await state.saveMemory?.();
  return { ok: true, consolidated: count };
}

export function handleMemoryStats(state: AppState) {
  return getMemoryStats(state.memory);
}

export function handleMemoryExport(state: AppState) {
  return state.memory;
}

export async function handleMemoryImport(state: AppState, body: { memory: MemoryStore }) {
  if (body.memory) {
    // Merge imported memory items
    state.memory.items.push(...(body.memory.items ?? []));
    state.memory.l1Buffer.push(...(body.memory.l1Buffer ?? []));
    state.memory.l2Buffer.push(...(body.memory.l2Buffer ?? []));
    await state.saveMemory?.();
  }
  return { ok: true };
}

export async function handleMemoryClear(state: AppState) {
  state.memory.items = [];
  state.memory.l1Buffer = [];
  state.memory.l2Buffer = [];
  await state.saveMemory?.();
  return { ok: true };
}

export function handleGetFallbackModels(state: AppState) {
  const provider = state.providers.find((p) => p.enabled);
  if (!provider) return [];
  return getFallbackModels(provider);
}

export async function handleTTS(state: AppState, body: {
  text: string; stylePrompt?: string; voice?: string; format?: string;
  speed?: number; ttsProviderId?: string; model?: string; agentId?: string; instructions?: string;
}) {
  const agentTTS = body.agentId ? state.agentTTSConfigs.find((c) => c.agentId === body.agentId) : undefined;
  const providerId = body.ttsProviderId ?? agentTTS?.ttsProviderId;
  const ttsProvider = (providerId ? state.ttsProviders.find((p) => p.id === providerId) : null) ??
    state.ttsProviders.find((p) => p.enabled && p.apiKey) ??
    state.ttsProviders.find((p) => p.enabled);

  if (!ttsProvider) throw new Error("No TTS provider configured");

  return callTTS({
    text: body.text,
    ttsProvider,
    voice: body.voice ?? agentTTS?.voice,
    model: body.model ?? agentTTS?.model,
    format: (body.format ?? "wav") as "wav" | "mp3" | "pcm16",
    speed: body.speed ?? agentTTS?.speed,
    stylePrompt: body.stylePrompt ?? agentTTS?.stylePrompt,
    instructions: body.instructions,
  });
}

// ─── Streaming handlers (async generators) ──────────────────────

export interface StreamEvent {
  type: string;
  data: unknown;
}

export async function* handleChatStream(
  state: AppState,
  body: {
    conversationId: string; message: string; agentId?: string;
    providerId?: string; model?: string; imageData?: string;
    additionalImages?: string[]; attachedFiles?: Array<{ name: string; type: string; size: number; content?: string }>;
    specifiedSkill?: string;
  },
): AsyncGenerator<StreamEvent> {
  let conv = state.conversations.get(body.conversationId);
  if (!conv) {
    conv = { id: body.conversationId, title: "新对话", type: "chat", agentIds: [], messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    state.conversations.set(conv.id, conv);
  }

  const userMsg: ChatMessage = {
    id: uid(), role: "user", content: body.message,
    imageData: body.imageData, additionalImages: body.additionalImages,
    attachedFiles: body.attachedFiles, createdAt: new Date().toISOString(),
  };
  conv.messages.push(userMsg);

  const provider = state.providers.find((p) => p.id === body.providerId) ?? state.providers.find((p) => p.enabled && p.apiKey);
  if (!provider) { yield { type: "error", data: { error: "No available provider" } }; return; }

  const model = body.model ?? provider.defaultModel ?? getFallbackModels(provider)[0]?.id;
  if (!model) { yield { type: "error", data: { error: "No model available" } }; return; }

  const agentId = body.agentId ?? "agent-moderator";

  try {
    let fullContent = "";
    const skillsForAgent = state.installedSkills.filter((s) => s.installed).map((s) => ({ nameZh: s.nameZh || s.name, descriptionZh: s.descriptionZh || s.description, capabilities: s.capabilities }));
    for await (const chunk of streamAgentMessage(conv, body.message, agentId, provider, model, skillsForAgent, body.specifiedSkill, state.memory)) {
      if (chunk.type === "text" && chunk.content) {
        fullContent += chunk.content;
        yield { type: "text", data: chunk };
      } else if (chunk.type === "usage") {
        yield { type: "usage", data: { usage: chunk.usage } };
      } else if (chunk.type === "done") {
        const agent = getAgentById(agentId);
        const assistantMsg: ChatMessage = {
          id: uid(), role: "assistant", content: fullContent,
          agentId: agent?.id, agentName: agent?.name, agentColor: agent?.color,
          createdAt: new Date().toISOString(),
        };
        conv.messages.push(assistantMsg);
        conv.updatedAt = new Date().toISOString();
        await state.saveConversations?.();

        try {
          const captured = captureConversationMemory(state.memory, body.message, fullContent, body.conversationId, assistantMsg.id);
          if (captured) await state.saveMemory?.();
        } catch {}

        yield { type: "done", data: { messageId: assistantMsg.id } };
      } else if (chunk.type === "error") {
        yield { type: "error", data: chunk };
      }
    }
  } catch (err) {
    yield { type: "error", data: { error: err instanceof Error ? err.message : String(err) } };
  }
}

export async function* handleRoundtableStream(
  state: AppState,
  body: { topic: string; agentIds: string[]; rounds?: number; providerId?: string; model?: string },
): AsyncGenerator<StreamEvent> {
  const provider = state.providers.find((p) => p.id === body.providerId) ?? state.providers.find((p) => p.enabled && p.apiKey);
  if (!provider) { yield { type: "error", data: { error: "No available provider" } }; return; }

  const model = body.model ?? provider.defaultModel ?? getFallbackModels(provider)[0]?.id;
  if (!model) { yield { type: "error", data: { error: "No model available" } }; return; }

  const agentList = body.agentIds.map((id) => state.agents.find((a) => a.id === id)).filter(Boolean) as AgentConfig[];
  if (agentList.length === 0) { yield { type: "error", data: { error: "No agents found" } }; return; }

  const roundtableState = createRoundtable(body.topic, agentList, body.rounds ?? 3);
  state.roundtables.set(roundtableState.conversation.id, roundtableState);
  state.conversations.set(roundtableState.conversation.id, roundtableState.conversation);

  try {
    yield { type: "start", data: { topic: body.topic, agents: agentList.map((a) => ({ id: a.id, name: a.name, avatar: a.avatar })) } };
    for await (const chunk of runRoundtableDiscussion(roundtableState, provider, model, state.memory)) {
      if (chunk.type === "text") yield { type: "text", data: chunk };
      else if (chunk.type === "error") yield { type: "error", data: chunk };
      else if (chunk.type === "done") {
        const report = generateReport(roundtableState);
        yield { type: "report", data: report };
        yield { type: "done", data: { conversationId: roundtableState.conversation.id } };
      }
    }
    await state.saveConversations?.();
  } catch (err) {
    yield { type: "error", data: { error: err instanceof Error ? err.message : String(err) } };
  }
}

export async function* handleSequentialStream(
  state: AppState,
  body: { topic: string; agentIds: string[]; conversationId?: string; providerId?: string; model?: string },
): AsyncGenerator<StreamEvent> {
  const provider = state.providers.find((p) => p.id === body.providerId) ?? state.providers.find((p) => p.enabled && p.apiKey);
  if (!provider) { yield { type: "error", data: { error: "No available provider" } }; return; }
  const model = body.model ?? provider.defaultModel ?? getFallbackModels(provider)[0]?.id;
  if (!model) { yield { type: "error", data: { error: "No model" } }; return; }

  const agentList = body.agentIds.map((id) => state.agents.find((a) => a.id === id)).filter(Boolean) as AgentConfig[];
  const convId = body.conversationId ?? uid();
  let conv = state.conversations.get(convId);
  if (!conv) {
    conv = { id: convId, title: `顺序: ${body.topic.slice(0, 30)}`, type: "group-chat", agentIds: body.agentIds, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    state.conversations.set(conv.id, conv);
  }

  try {
    yield { type: "start", data: { mode: "sequential", topic: body.topic } };
    for await (const chunk of runSequential(agentList, body.topic, provider, model, conv)) {
      if (chunk.type === "text") yield { type: "text", data: chunk };
      else if (chunk.type === "done") yield { type: "done", data: { conversationId: conv.id } };
    }
    await state.saveConversations?.();
  } catch (err) {
    yield { type: "error", data: { error: err instanceof Error ? err.message : String(err) } };
  }
}

export async function* handleHierarchicalStream(
  state: AppState,
  body: { topic: string; moderatorId?: string; workerIds: string[]; rounds?: number; providerId?: string; model?: string },
): AsyncGenerator<StreamEvent> {
  const provider = state.providers.find((p) => p.id === body.providerId) ?? state.providers.find((p) => p.enabled && p.apiKey);
  if (!provider) { yield { type: "error", data: { error: "No available provider" } }; return; }
  const model = body.model ?? provider.defaultModel ?? getFallbackModels(provider)[0]?.id;
  if (!model) { yield { type: "error", data: { error: "No model" } }; return; }

  const moderator = state.agents.find((a) => a.id === (body.moderatorId ?? "agent-moderator")) ?? state.agents[0];
  const workers = body.workerIds.map((id) => state.agents.find((a) => a.id === id)).filter(Boolean) as AgentConfig[];

  const convId = uid();
  const conv: Conversation = { id: convId, title: `层级: ${body.topic.slice(0, 30)}`, type: "group-chat", agentIds: [moderator.id, ...body.workerIds], messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  state.conversations.set(conv.id, conv);

  try {
    yield { type: "start", data: { mode: "hierarchical", topic: body.topic } };
    for await (const chunk of runHierarchical(moderator, workers, body.topic, provider, model, conv, body.rounds ?? 2)) {
      if (chunk.type === "text") yield { type: "text", data: chunk };
      else if (chunk.type === "done") yield { type: "done", data: { conversationId: conv.id } };
    }
    await state.saveConversations?.();
  } catch (err) {
    yield { type: "error", data: { error: err instanceof Error ? err.message : String(err) } };
  }
}

// ─── Provider Test & Discover ──────────────────────────────────

export async function handleTestProvider(state: AppState, body: { providerId: string }) {
  const provider = state.providers.find((p) => p.id === body.providerId);
  if (!provider) return { ok: false, error: "Provider not found" };
  const start = Date.now();
  try {
    const models = await discoverModels(provider);
    return { ok: true, modelCount: models.length, latencyMs: Date.now() - start };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start };
  }
}

export async function handleDiscoverModels(state: AppState, body: { providerId: string }) {
  const provider = state.providers.find((p) => p.id === body.providerId);
  if (!provider) throw new Error("Provider not found");
  const models = await discoverModels(provider);
  provider.modelsDiscovered = models.length;
  if (state.saveProviders) await state.saveProviders();
  return { models, count: models.length };
}

export function handleDeleteAgent(state: AppState, agentId: string) {
  state.agents = state.agents.filter((a) => a.id !== agentId);
  if (state.saveAgents) state.saveAgents();
  return { ok: true };
}

export function handleDeleteMemory(state: AppState, memoryId: string) {
  state.memory.items = state.memory.items.filter((m) => m.id !== memoryId);
  state.memory.l1Buffer = state.memory.l1Buffer.filter((m) => m.id !== memoryId);
  state.memory.l2Buffer = state.memory.l2Buffer.filter((m) => m.id !== memoryId);
  if (state.saveMemory) state.saveMemory();
  return { ok: true };
}

export async function handleInstallSkillGithub(state: AppState, body: { url: string }) {
  // Simple GitHub skill installation - create a placeholder skill from URL
  const urlParts = body.url.replace(/\/$/, "").split("/");
  const repo = urlParts.slice(-2).join("/");
  const skill: any = {
    id: `github-${repo.replace("/", "-")}`,
    name: urlParts[urlParts.length - 1],
    nameZh: urlParts[urlParts.length - 1],
    description: `Skill from ${repo}`,
    descriptionZh: `来自 ${repo} 的技能`,
    author: urlParts[urlParts.length - 2],
    repo: body.url,
    category: "custom",
    categoryZh: "自定义",
    installed: true,
    source: "github",
    capabilities: [],
    useCases: [],
    installedAt: new Date().toISOString(),
  };
  state.installedSkills = [...state.installedSkills.filter((s: any) => s.id !== skill.id), skill];
  if (state.saveSkills) await state.saveSkills();
  return { skill };
}

export async function handleRefreshStars(state: AppState) {
  // In mobile mode, just return current skills
  return { skills: state.installedSkills };
}

// ─── Code Generation Streaming ─────────────────────────────────

export async function* handleCodeGenStream(
  state: AppState,
  body: { idea: string; techStack?: string; providerId?: string; model?: string }
): AsyncGenerator<StreamEvent> {
  const provider = state.providers.find((p) => p.id === body.providerId) ?? state.providers.find((p) => p.enabled && p.apiKey);
  if (!provider) { yield { type: "error", data: { error: "No available provider" } }; return; }

  const model = body.model ?? provider.defaultModel ?? getFallbackModels(provider)[0]?.id;
  if (!model) { yield { type: "error", data: { error: "No model available" } }; return; }

  // Simple codegen: send the idea to the model and stream the response
  const messages = [
    { role: "system", content: `你是一个全栈开发专家。用户会描述一个应用想法，你需要：
1. 分析需求
2. 设计架构
3. 生成核心代码
4. 编写测试
5. 生成文档
6. 代码审查

技术栈：${body.techStack ?? "Vite + React + TypeScript"}

请按阶段输出，每个阶段用 [阶段名] 标记。` },
    { role: "user", content: body.idea },
  ];

  const phases = ["requirements", "design", "generation", "testing", "documentation", "review"];
  let currentPhase = 0;

  yield { type: "phase", data: { phase: phases[0] } };

  try {
    for await (const chunk of streamChatCompletion({ provider, model, messages })) {
      if (chunk.type === "text" && chunk.content) {
        const text = chunk.content;
        yield { type: "message", data: { phase: phases[currentPhase], content: text, agentName: "AI 开发者" } };
        // Simple phase detection
        if (text.includes("[设计]") || text.includes("## 设计")) {
          currentPhase = 1;
          yield { type: "phase", data: { phase: phases[1] } };
        } else if (text.includes("[生成]") || text.includes("## 代码") || text.includes("```")) {
          currentPhase = 2;
          yield { type: "phase", data: { phase: phases[2] } };
        }
      } else if (chunk.type === "error") {
        yield { type: "error", data: { error: chunk.error } };
      }
    }
  } catch (err) {
    yield { type: "error", data: { error: err instanceof Error ? err.message : String(err) } };
  }
}
