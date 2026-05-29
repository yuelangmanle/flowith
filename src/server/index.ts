import http from "node:http";
import { mkdir, readFile, writeFile as fsWriteFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  createDefaultProviders,
  discoverModels,
  streamChatCompletion,
  getFallbackModels,
  createDefaultTTSProviders,
  callTTS,
} from "../core/modelGateway";
import { DEFAULT_AGENTS, createUserAgent, getAgentById } from "../core/agentConfig";
import {
  createRoundtable,
  runRoundtableDiscussion,
  createVoteSession,
  castVote,
  closeVote,
  getVoteResults,
  generateReport,
} from "../core/roundtable";
import { runSequential, runHierarchical, streamAgentMessage } from "../core/agentOrchestrator";
import { createCodeGenRun, runFullPipeline, getProgressPercentage } from "../core/codeGeneration";
import { createMemoryStore, addToL1, addToL2, addFact, queryMemory, writeMemory, getMemoryStats, evictExpiredMemories, findSimilarMemories } from "../core/memoryKnowledge";
import { captureConversationMemory, consolidateMemories } from "../core/memoryConsolidator";
import { extractFileContent } from "./fileExtractor";
import type {
  Conversation,
  ChatMessage,
  ProviderConfig,
  TTSProviderConfig,
  VoteSession,
  CodeGenRun,
  AgentConfig,
  MemoryItem,
} from "../core/types";
import type { RoundtableState } from "../core/roundtable";
import type { MemoryStore } from "../core/memoryKnowledge";

// ─── Paths ──────────────────────────────────────────────────────

// Support custom data directory (for Tauri packaged mode)
const baseDir = process.env.AGENT_DATA_DIR || process.cwd();
const workspaceRoot = resolve(baseDir, ".agent-workspaces");
const dataDir = resolve(baseDir, ".agent-data");
const providersFile = resolve(dataDir, "providers.json");
const conversationsFile = resolve(dataDir, "conversations.json");
const agentsFile = resolve(dataDir, "agents.json");
const agentModelFile = resolve(dataDir, "agent-models.json");
const agentTTSFile = resolve(dataDir, "agent-tts.json");
const memoryFile = resolve(dataDir, "memory.json");
const skillsFile = resolve(dataDir, "skills.json");

// ─── State ──────────────────────────────────────────────────────

let providers: ProviderConfig[] = createDefaultProviders();
let agents: AgentConfig[] = [...DEFAULT_AGENTS];
let agentModelConfigs: Array<{ agentId: string; providerId: string; modelId: string; useGlobal?: boolean }> = [];
let agentTTSConfigs: Array<{ agentId: string; enabled: boolean; ttsProviderId?: string; voice?: string; speed?: number; stylePrompt?: string; model?: string; autoSpeak?: boolean }> = [];
const conversations = new Map<string, Conversation>();
const roundtables = new Map<string, RoundtableState>();
const votes = new Map<string, VoteSession>();
const codeGenRuns = new Map<string, CodeGenRun>();
const memory: MemoryStore = createMemoryStore();
const ttsProvidersFile = resolve(dataDir, "tts-providers.json");
let ttsProviders: TTSProviderConfig[] = createDefaultTTSProviders();
interface InstalledSkill { id: string; name: string; nameZh?: string; description: string; descriptionZh?: string; installed: boolean; capabilities?: string[]; repo?: string; source?: string; stars?: number; [key: string]: unknown; }
let installedSkills: InstalledSkill[] = [];

// ─── Persistence ────────────────────────────────────────────────

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function loadFromDisk() {
  try {
    const raw = await readFile(providersFile, "utf8");
    const saved = JSON.parse(raw) as ProviderConfig[];
    if (Array.isArray(saved) && saved.length > 0) {
      // Merge: keep saved settings, but include any new default providers
      const defaults = createDefaultProviders();
      const merged = [...saved];
      for (const def of defaults) {
        if (!merged.find((p) => p.id === def.id)) {
          merged.push(def);
        }
      }
      providers = merged;
    }
  } catch { /* use defaults */ }

  try {
    const raw = await readFile(conversationsFile, "utf8");
    const saved = JSON.parse(raw) as Conversation[];
    if (Array.isArray(saved)) for (const conv of saved) conversations.set(conv.id, conv);
  } catch { /* empty */ }

  try {
    const raw = await readFile(agentsFile, "utf8");
    const saved = JSON.parse(raw) as AgentConfig[];
    if (Array.isArray(saved) && saved.length > 0) agents = saved;
  } catch { /* use defaults */ }

  try {
    const raw = await readFile(skillsFile, "utf8");
    const saved = JSON.parse(raw);
    if (Array.isArray(saved)) installedSkills = saved;
  } catch { /* no skills saved yet */ }

  try {
    const raw = await readFile(memoryFile, "utf8");
    const saved = JSON.parse(raw) as MemoryStore;
    if (saved && Array.isArray(saved.items)) {
      memory.items = saved.items;
      memory.l1Buffer = saved.l1Buffer ?? [];
      memory.l2Buffer = saved.l2Buffer ?? [];
    }
  } catch { /* no memory saved yet */ }
}

async function loadTTSProvidersFromDisk() {
  try {
    const raw = await readFile(ttsProvidersFile, "utf8");
    const saved = JSON.parse(raw) as TTSProviderConfig[];
    if (Array.isArray(saved) && saved.length > 0) {
      const defaults = createDefaultTTSProviders();
      const merged = [...saved];
      for (const def of defaults) {
        if (!merged.find((p) => p.id === def.id)) merged.push(def);
      }
      ttsProviders = merged;
    }
  } catch { /* use defaults */ }
}

async function saveTTSProvidersToDisk() {
  try {
    await ensureDataDir();
    await fsWriteFile(ttsProvidersFile, JSON.stringify(ttsProviders, null, 2), "utf8");
  } catch { /* silently fail */ }
}

async function saveProvidersToDisk() {
  try {
    await ensureDataDir();
    await fsWriteFile(providersFile, JSON.stringify(providers, null, 2), "utf8");
  } catch { /* silently fail */ }
}

async function saveConversationsToDisk() {
  try {
    await ensureDataDir();
    const list = Array.from(conversations.values());
    await fsWriteFile(conversationsFile, JSON.stringify(list, null, 2), "utf8");
  } catch { /* silently fail */ }
}

async function saveMemoryToDisk() {
  try {
    await fsWriteFile(memoryFile, JSON.stringify(memory, null, 2));
  } catch {}
}

async function saveAgentsToDisk() {
  try {
    await ensureDataDir();
    await fsWriteFile(agentsFile, JSON.stringify(agents, null, 2), "utf8");
  } catch { /* silently fail */ }
}

async function loadAgentModelConfigs() {
  try {
    const raw = await readFile(agentModelFile, "utf8");
    const saved = JSON.parse(raw);
    if (Array.isArray(saved)) agentModelConfigs = saved;
  } catch { /* empty */ }
}

async function loadAgentTTSConfigs() {
  try {
    const raw = await readFile(agentTTSFile, "utf8");
    const saved = JSON.parse(raw);
    if (Array.isArray(saved)) agentTTSConfigs = saved;
  } catch { /* empty */ }
}

async function saveAgentTTSConfigsToDisk() {
  try {
    await ensureDataDir();
    await fsWriteFile(agentTTSFile, JSON.stringify(agentTTSConfigs, null, 2), "utf8");
  } catch { /* silently fail */ }
}

async function saveAgentModelConfigsToDisk() {
  try {
    await ensureDataDir();
    await fsWriteFile(agentModelFile, JSON.stringify(agentModelConfigs, null, 2), "utf8");
  } catch { /* silently fail */ }
}

// ─── Helpers ────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: http.ServerResponse, status: number, body: unknown) {
  if (response.headersSent) return;
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(body));
}

function sendSSE(response: http.ServerResponse, event: string, data: unknown) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Server ─────────────────────────────────────────────────────

export async function createServer() {
  await mkdir(workspaceRoot, { recursive: true });
  await ensureDataDir();
  await loadFromDisk();
  await loadTTSProvidersFromDisk();

  // Auto-sync MiMo TTS API key from model provider if empty
  const mimoProvider = providers.find((p) => p.type === "xiaomi-mimo");
  const mimoTTS = ttsProviders.find((p) => p.type === "mimo-tts");
  if (mimoProvider && mimoTTS && !mimoTTS.apiKey && mimoProvider.apiKey) {
    mimoTTS.apiKey = mimoProvider.apiKey;
    if (mimoProvider.altBaseUrl) mimoTTS.mimoAltBaseUrl = mimoProvider.altBaseUrl;
    await saveTTSProvidersToDisk();
  }

  return http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") {
        response.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type",
        });
        response.end();
        return;
      }

      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      const path = url.pathname;

      // ─── Health ──────────────────────────────────────
      if (request.method === "GET" && path === "/api/health") {
        return send(response, 200, {
          ok: true, version: "0.3.0",
          workspaceRoot, providers: providers.length,
          conversations: conversations.size, agents: agents.length,
        });
      }

      // ─── Providers ───────────────────────────────────
      if (request.method === "GET" && path === "/api/providers") {
        return send(response, 200, providers);
      }
      if (request.method === "PUT" && path === "/api/providers") {
        const body = await readJson(request) as { providers?: ProviderConfig[] };
        if (body.providers) {
          providers = body.providers;
          await saveProvidersToDisk();
        }
        return send(response, 200, { ok: true });
      }
      if (request.method === "POST" && path === "/api/providers/test") {
        const body = await readJson(request) as { providerId: string };
        const provider = providers.find((p) => p.id === body.providerId);
        if (!provider) return send(response, 404, { error: "Provider not found" });
        const start = Date.now();
        try {
          const models = await discoverModels(provider);
          return send(response, 200, { ok: true, modelCount: models.length, latencyMs: Date.now() - start });
        } catch (err) {
          return send(response, 200, { ok: false, error: err instanceof Error ? err.message : String(err), latencyMs: Date.now() - start });
        }
      }
      if (request.method === "POST" && path === "/api/providers/discover") {
        const body = await readJson(request) as { providerId: string };
        const provider = providers.find((p) => p.id === body.providerId);
        if (!provider) return send(response, 404, { error: "Provider not found" });
        try {
          const models = await discoverModels(provider);
          provider.modelsDiscovered = models.length;
          await saveProvidersToDisk();
          return send(response, 200, { models, count: models.length });
        } catch (err) {
          return send(response, 500, { error: err instanceof Error ? err.message : String(err) });
        }
      }

      // ─── Agents ──────────────────────────────────────
      if (request.method === "GET" && path === "/api/agents") {
        return send(response, 200, agents);
      }
      if (request.method === "POST" && path === "/api/agents") {
        const body = await readJson(request) as Partial<AgentConfig>;
        const newAgent = createUserAgent({
          name: body.name ?? "自定义 Agent",
          role: (body.role as AgentConfig["role"]) ?? "coder",
          avatar: body.avatar ?? "✦",
          goal: body.goal ?? "",
          systemPrompt: body.systemPrompt ?? "你是一个 AI 助手。",
          tools: body.tools,
          color: body.color,
        });
        agents.push(newAgent);
        await saveAgentsToDisk();
        return send(response, 200, newAgent);
      }
      if (request.method === "DELETE" && path.startsWith("/api/agents/")) {
        const agentId = path.split("/").pop();
        agents = agents.filter((a) => a.id !== agentId || !a.custom);
        await saveAgentsToDisk();
        return send(response, 200, { ok: true });
      }

      // ─── Conversations ───────────────────────────────
      if (request.method === "GET" && path === "/api/conversations") {
        return send(response, 200, Array.from(conversations.values()));
      }
      if (request.method === "PUT" && path === "/api/conversations") {
        const body = await readJson(request) as { conversations?: Conversation[] };
        if (body.conversations) {
          for (const conv of body.conversations) conversations.set(conv.id, conv);
          await saveConversationsToDisk();
        }
        return send(response, 200, { ok: true });
      }
      if (request.method === "POST" && path === "/api/conversations") {
        const body = await readJson(request) as Partial<Conversation>;
        const conv: Conversation = {
          id: uid(),
          title: body.title ?? "新对话",
          type: body.type ?? "chat",
          agentIds: body.agentIds ?? [],
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        conversations.set(conv.id, conv);
        await saveConversationsToDisk();
        return send(response, 200, conv);
      }
      if (request.method === "DELETE" && path.startsWith("/api/conversations/")) {
        const convId = path.split("/").pop();
        if (convId) conversations.delete(convId);
        await saveConversationsToDisk();
        return send(response, 200, { ok: true });
      }

      // ─── Chat (Streaming) ────────────────────────────
      if (request.method === "POST" && path === "/api/chat") {
        const body = await readJson(request) as {
          conversationId: string;
          message: string;
          agentId?: string;
          providerId?: string;
          model?: string;
          imageData?: string;              // base64 data URL (first image, backward compat)
          additionalImages?: string[];     // remaining images
          attachedFiles?: Array<{ name: string; type: string; size: number; content?: string }>;
          specifiedSkill?: string;         // 用户指定使用的 skill 名称
        };

        let conv = conversations.get(body.conversationId);
        if (!conv) {
          conv = { id: body.conversationId, title: "新对话", type: "chat", agentIds: [], messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          conversations.set(conv.id, conv);
        }

        const userMsg: ChatMessage = {
          id: uid(), role: "user", content: body.message,
          imageData: body.imageData,
          additionalImages: body.additionalImages,
          attachedFiles: body.attachedFiles,
          createdAt: new Date().toISOString(),
        };
        conv.messages.push(userMsg);

        const provider = providers.find((p) => p.id === body.providerId) ?? providers.find((p) => p.enabled && p.apiKey);
        if (!provider) return send(response, 400, { error: "No available provider" });

        const model = body.model ?? provider.defaultModel ?? getFallbackModels(provider)[0]?.id;
        if (!model) return send(response, 400, { error: "No model available" });

        const agentId = body.agentId ?? "agent-moderator";

        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "access-control-allow-origin": "*",
        });

        const timeout = setTimeout(() => {
          try { sendSSE(response, "error", { error: "Timeout (120s)" }); response.end(); } catch {}
        }, 120000);

        try {
          let fullContent = "";
          const skillsForAgent = installedSkills.filter((s) => s.installed).map((s) => ({ nameZh: s.nameZh || s.name, descriptionZh: s.descriptionZh || s.description, capabilities: s.capabilities }));
          for await (const chunk of streamAgentMessage(conv, body.message, agentId, provider, model, skillsForAgent, body.specifiedSkill, memory)) {
            if (chunk.type === "text" && chunk.content) {
              fullContent += chunk.content;
              sendSSE(response, "text", chunk);
            } else if (chunk.type === "usage") {
              sendSSE(response, "usage", { usage: chunk.usage });
            } else if (chunk.type === "done") {
              clearTimeout(timeout);
              const agent = getAgentById(agentId);
              const assistantMsg: ChatMessage = {
                id: uid(), role: "assistant", content: fullContent,
                agentId: agent?.id, agentName: agent?.name, agentColor: agent?.color,
                createdAt: new Date().toISOString(),
              };
              conv.messages.push(assistantMsg);
              conv.updatedAt = new Date().toISOString();
              await saveConversationsToDisk();

              // Auto-capture memory from conversation
              try {
                const captured = captureConversationMemory(memory, body.message, fullContent, body.conversationId, assistantMsg.id);
                if (captured) await saveMemoryToDisk();
              } catch {}
              sendSSE(response, "done", { messageId: assistantMsg.id });
            } else if (chunk.type === "error") {
              sendSSE(response, "error", chunk);
            }
          }
        } catch (err) {
          clearTimeout(timeout);
          sendSSE(response, "error", { error: err instanceof Error ? err.message : String(err) });
        }
        response.end();
        return;
      }

      // ─── Roundtable (Streaming) ──────────────────────
      if (request.method === "POST" && path === "/api/roundtable") {
        const body = await readJson(request) as {
          topic: string;
          agentIds: string[];
          rounds?: number;
          providerId?: string;
          model?: string;
        };

        const provider = providers.find((p) => p.id === body.providerId) ?? providers.find((p) => p.enabled && p.apiKey);
        if (!provider) return send(response, 400, { error: "No available provider" });

        const model = body.model ?? provider.defaultModel ?? getFallbackModels(provider)[0]?.id;
        if (!model) return send(response, 400, { error: "No model available" });

        const agentList = body.agentIds.map((id) => agents.find((a) => a.id === id)).filter(Boolean) as AgentConfig[];
        if (agentList.length === 0) return send(response, 400, { error: "No agents found" });

        const state = createRoundtable(body.topic, agentList, body.rounds ?? 3);
        roundtables.set(state.conversation.id, state);
        conversations.set(state.conversation.id, state.conversation);

        response.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "access-control-allow-origin": "*",
        });

        const timeout = setTimeout(() => {
          try { sendSSE(response, "error", { error: "圆桌讨论超时 (300s)" }); response.end(); } catch {}
        }, 300000);

        try {
          sendSSE(response, "start", { topic: body.topic, agents: agentList.map((a) => ({ id: a.id, name: a.name, avatar: a.avatar })) });
          for await (const chunk of runRoundtableDiscussion(state, provider, model, memory)) {
            if (chunk.type === "text") sendSSE(response, "text", chunk);
            else if (chunk.type === "error") sendSSE(response, "error", chunk);
            else if (chunk.type === "done") {
              clearTimeout(timeout);
              const report = generateReport(state);
              sendSSE(response, "report", report);
              sendSSE(response, "done", { conversationId: state.conversation.id });
            }
          }
          await saveConversationsToDisk();
        } catch (err) {
          clearTimeout(timeout);
          sendSSE(response, "error", { error: err instanceof Error ? err.message : String(err) });
        }
        response.end();
        return;
      }

      // ─── Sequential Mode ─────────────────────────────
      if (request.method === "POST" && path === "/api/orchestrate/sequential") {
        const body = await readJson(request) as {
          topic: string;
          agentIds: string[];
          conversationId?: string;
          providerId?: string;
          model?: string;
        };

        const provider = providers.find((p) => p.id === body.providerId) ?? providers.find((p) => p.enabled && p.apiKey);
        if (!provider) return send(response, 400, { error: "No available provider" });
        const model = body.model ?? provider.defaultModel ?? getFallbackModels(provider)[0]?.id;
        if (!model) return send(response, 400, { error: "No model" });

        const agentList = body.agentIds.map((id) => agents.find((a) => a.id === id)).filter(Boolean) as AgentConfig[];
        const convId = body.conversationId ?? uid();
        let conv = conversations.get(convId);
        if (!conv) {
          conv = { id: convId, title: `顺序: ${body.topic.slice(0, 30)}`, type: "group-chat", agentIds: body.agentIds, messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          conversations.set(conv.id, conv);
        }

        response.writeHead(200, {
          "content-type": "text/event-stream", "cache-control": "no-cache",
          connection: "keep-alive", "access-control-allow-origin": "*",
        });

        try {
          sendSSE(response, "start", { mode: "sequential", topic: body.topic });
          for await (const chunk of runSequential(agentList, body.topic, provider, model, conv)) {
            if (chunk.type === "text") sendSSE(response, "text", chunk);
            else if (chunk.type === "done") sendSSE(response, "done", { conversationId: conv.id });
          }
          await saveConversationsToDisk();
        } catch (err) {
          sendSSE(response, "error", { error: err instanceof Error ? err.message : String(err) });
        }
        response.end();
        return;
      }

      // ─── Hierarchical Mode ───────────────────────────
      if (request.method === "POST" && path === "/api/orchestrate/hierarchical") {
        const body = await readJson(request) as {
          topic: string;
          moderatorId?: string;
          workerIds: string[];
          rounds?: number;
          providerId?: string;
          model?: string;
        };

        const provider = providers.find((p) => p.id === body.providerId) ?? providers.find((p) => p.enabled && p.apiKey);
        if (!provider) return send(response, 400, { error: "No available provider" });
        const model = body.model ?? provider.defaultModel ?? getFallbackModels(provider)[0]?.id;
        if (!model) return send(response, 400, { error: "No model" });

        const moderator = agents.find((a) => a.id === (body.moderatorId ?? "agent-moderator")) ?? agents[0];
        const workers = body.workerIds.map((id) => agents.find((a) => a.id === id)).filter(Boolean) as AgentConfig[];

        const convId = uid();
        const conv: Conversation = { id: convId, title: `层级: ${body.topic.slice(0, 30)}`, type: "group-chat", agentIds: [moderator.id, ...body.workerIds], messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        conversations.set(conv.id, conv);

        response.writeHead(200, {
          "content-type": "text/event-stream", "cache-control": "no-cache",
          connection: "keep-alive", "access-control-allow-origin": "*",
        });

        try {
          sendSSE(response, "start", { mode: "hierarchical", topic: body.topic });
          for await (const chunk of runHierarchical(moderator, workers, body.topic, provider, model, conv, body.rounds ?? 2)) {
            if (chunk.type === "text") sendSSE(response, "text", chunk);
            else if (chunk.type === "done") sendSSE(response, "done", { conversationId: conv.id });
          }
          await saveConversationsToDisk();
        } catch (err) {
          sendSSE(response, "error", { error: err instanceof Error ? err.message : String(err) });
        }
        response.end();
        return;
      }

      // ─── Code Generation ─────────────────────────────
      if (request.method === "POST" && path === "/api/codegen") {
        const body = await readJson(request) as {
          idea: string;
          techStack?: string;
          providerId?: string;
          model?: string;
        };

        const provider = providers.find((p) => p.id === body.providerId) ?? providers.find((p) => p.enabled && p.apiKey);
        if (!provider) return send(response, 400, { error: "No available provider" });
        const model = body.model ?? provider.defaultModel ?? getFallbackModels(provider)[0]?.id;
        if (!model) return send(response, 400, { error: "No model" });

        const projectId = `proj-${Date.now()}`;
        const run = createCodeGenRun(projectId, body.idea, body.techStack ?? "Vite + React + TypeScript");
        codeGenRuns.set(run.id, run);

        response.writeHead(200, {
          "content-type": "text/event-stream", "cache-control": "no-cache",
          connection: "keep-alive", "access-control-allow-origin": "*",
        });

        try {
          sendSSE(response, "start", { runId: run.id, idea: body.idea });
          for await (const chunk of runFullPipeline(run, provider, model)) {
            if (chunk.type === "text") sendSSE(response, "text", chunk);
            else if (chunk.type === "done") {
              sendSSE(response, "progress", { phase: run.phase, percentage: getProgressPercentage(run) });
            }
          }
          sendSSE(response, "complete", { runId: run.id, status: run.status, artifacts: run.artifacts.length });
        } catch (err) {
          run.status = "failed";
          sendSSE(response, "error", { error: err instanceof Error ? err.message : String(err) });
        }
        response.end();
        return;
      }

      // ─── Voting ──────────────────────────────────────
      if (request.method === "POST" && path === "/api/votes") {
        const body = await readJson(request) as { topic: string; options: string[]; conversationId: string };
        const session = createVoteSession(body.topic, body.options, body.conversationId);
        votes.set(session.id, session);
        return send(response, 200, session);
      }
      if (request.method === "POST" && path === "/api/votes/cast") {
        const body = await readJson(request) as { voteId: string; optionId: string; agentId: string };
        const session = votes.get(body.voteId);
        if (!session) return send(response, 404, { error: "Vote not found" });
        const updated = castVote(session, body.optionId, body.agentId);
        votes.set(body.voteId, updated);
        return send(response, 200, updated);
      }
      if (request.method === "POST" && path === "/api/votes/close") {
        const body = await readJson(request) as { voteId: string };
        const session = votes.get(body.voteId);
        if (!session) return send(response, 404, { error: "Vote not found" });
        const closed = closeVote(session);
        votes.set(body.voteId, closed);
        return send(response, 200, { ...closed, results: getVoteResults(closed) });
      }

      // ─── Memory ──────────────────────────────────────
      if (request.method === "GET" && path === "/api/memory") {
        return send(response, 200, {
          items: memory.items,
          l1: memory.l1Buffer,
          l2: memory.l2Buffer,
          stats: {
            totalItems: memory.items.length + memory.l1Buffer.length + memory.l2Buffer.length,
            l1Count: memory.l1Buffer.length,
            l2Count: memory.l2Buffer.length,
            l3Count: memory.items.filter(m => m.layer === "L3-fact").length,
            l4Count: memory.items.filter(m => m.layer === "L4-episodic").length,
          }
        });
      }
      if (request.method === "POST" && path === "/api/memory/query") {
        const body = await readJson(request) as { query: string; limit?: number };
        const results = queryMemory(memory, body.query, body.limit ?? 10);
        return send(response, 200, results);
      }
      if (request.method === "POST" && path === "/api/memory/add") {
        const body = await readJson(request) as { content: string; type?: string; layer?: string; tags?: string[]; importance?: number };
        const item = writeMemory(memory, {
          type: (body.type as "fact" | "scenario") ?? "fact",
          content: body.content,
          source: {},
          tags: body.tags ?? [],
          importance: body.importance ?? 0.7,
        });
        await saveMemoryToDisk();
        return send(response, 200, item);
      }
      if (request.method === "DELETE" && path.startsWith("/api/memory/")) {
        const itemId = path.split("/").pop();
        const idx = memory.items.findIndex(m => m.id === itemId);
        if (idx >= 0) {
          memory.items.splice(idx, 1);
          await saveMemoryToDisk();
          return send(response, 200, { ok: true });
        }
        const l1Idx = memory.l1Buffer.findIndex(m => m.id === itemId);
        if (l1Idx >= 0) {
          memory.l1Buffer.splice(l1Idx, 1);
          await saveMemoryToDisk();
          return send(response, 200, { ok: true });
        }
        const l2Idx = memory.l2Buffer.findIndex(m => m.id === itemId);
        if (l2Idx >= 0) {
          memory.l2Buffer.splice(l2Idx, 1);
          await saveMemoryToDisk();
          return send(response, 200, { ok: true });
        }
        return send(response, 404, { error: "Memory item not found" });
      }
      if (request.method === "DELETE" && path === "/api/memory/clear") {
        const layer = url.searchParams.get("layer");
        if (layer === "L1" || layer === "all") memory.l1Buffer = [];
        if (layer === "L2" || layer === "all") memory.l2Buffer = [];
        if (layer === "L3" || layer === "all") memory.items = memory.items.filter(m => m.layer !== "L3-fact");
        if (layer === "L4" || layer === "all") memory.items = memory.items.filter(m => m.layer !== "L4-episodic");
        if (!layer || layer === "all") { memory.items = []; memory.l1Buffer = []; memory.l2Buffer = []; }
        await saveMemoryToDisk();
        return send(response, 200, { ok: true });
      }
      if (request.method === "POST" && path === "/api/memory/consolidate") {
        const result = consolidateMemories(memory);
        await saveMemoryToDisk();
        return send(response, 200, result);
      }
      if (request.method === "GET" && path === "/api/memory/stats") {
        return send(response, 200, getMemoryStats(memory));
      }
      if (request.method === "POST" && path === "/api/memory/export") {
        return send(response, 200, { items: memory.items, l1: memory.l1Buffer, l2: memory.l2Buffer, exportedAt: new Date().toISOString() });
      }
      if (request.method === "POST" && path === "/api/memory/import") {
        const body = await readJson(request) as { items?: MemoryItem[]; l1?: MemoryItem[]; l2?: MemoryItem[] };
        // Validate imported items
        const validItems = (items: MemoryItem[] | undefined) => (items ?? []).filter(m => m && m.content && m.layer && m.type);
        const vItems = validItems(body.items);
        const vL1 = validItems(body.l1);
        const vL2 = validItems(body.l2);
        // Dedup on import
        const existingContent = new Set([...memory.items, ...memory.l1Buffer, ...memory.l2Buffer].map(m => m.content.slice(0, 100)));
        const deduped = [...vItems, ...vL1, ...vL2].filter(m => !existingContent.has(m.content.slice(0, 100)));
        for (const item of deduped) {
          if (item.layer === "L1-conversation") memory.l1Buffer.push(item);
          else if (item.layer === "L2-working") memory.l2Buffer.push(item);
          else memory.items.push(item);
        }
        await saveMemoryToDisk();
        return send(response, 200, { ok: true, imported: deduped.length, skipped: (vItems.length + vL1.length + vL2.length) - deduped.length });
      }
      if (request.method === "GET" && path.startsWith("/api/memory/relations/")) {
        const itemId = path.split("/").pop();
        const item = [...memory.items, ...memory.l1Buffer, ...memory.l2Buffer].find(m => m.id === itemId);
        if (!item) return send(response, 404, { error: "Memory not found" });
        const related = (item.relatedIds ?? []).map(id => [...memory.items, ...memory.l1Buffer, ...memory.l2Buffer].find(m => m.id === id)).filter(Boolean);
        return send(response, 200, { item, related });
      }

      // ─── Fallback Models ─────────────────────────────
      if (request.method === "GET" && path === "/api/models/fallback") {
        const providerId = url.searchParams.get("providerId");
        const provider = providers.find((p) => p.id === providerId);
        if (!provider) return send(response, 404, { error: "Provider not found" });
        return send(response, 200, getFallbackModels(provider));
      }

      // ─── Agent Model Configs ──────────────────────────
      if (request.method === "GET" && path === "/api/agent-models") {
        return send(response, 200, agentModelConfigs);
      }
      if (request.method === "PUT" && path === "/api/agent-models") {
        const body = await readJson(request) as { configs: typeof agentModelConfigs };
        if (body.configs) {
          agentModelConfigs = body.configs;
          await saveAgentModelConfigsToDisk();
        }
        return send(response, 200, { ok: true });
      }

      

      // ─── Skills ──────────────────────────────────────
      
      if (request.method === "POST" && path === "/api/skills/refresh-stars") {
        try {
          const updated = await Promise.all(installedSkills.map(async (skill) => {
            if (!skill.repo || skill.source === "local") return skill;
            const urlMatch = skill.repo.match(/github\.com\/([^/]+)\/([^/\s]+)/);
            if (!urlMatch) return skill;
            const [, owner, repo] = urlMatch;
            try {
              const resp = await fetch(`https://api.github.com/repos/${owner}/${repo.replace(/\.git$/, "")}`, {
                headers: { "Accept": "application/vnd.github.v3+json" },
              });
              if (resp.ok) {
                const data = await resp.json();
                return { ...skill, stars: data.stargazers_count ?? skill.stars };
              }
            } catch {}
            return skill;
          }));
          installedSkills = updated;
          await mkdir(dataDir, { recursive: true });
          await fsWriteFile(skillsFile, JSON.stringify(installedSkills, null, 2));
          return send(response, 200, { ok: true, count: updated.length });
        } catch (err) {
          return send(response, 500, { error: "刷新失败" });
        }
      }

      if (request.method === "GET" && path === "/api/skills") {
        return send(response, 200, installedSkills);
      }

      if (request.method === "PUT" && path === "/api/skills") {
        const body = await readJson(request) as { skills: any[] };
        installedSkills = body.skills ?? [];
        await mkdir(dataDir, { recursive: true });
        await fsWriteFile(skillsFile, JSON.stringify(installedSkills, null, 2));
        return send(response, 200, { ok: true, count: installedSkills.length });
      }

      if (request.method === "POST" && path === "/api/skills/install-url") {
        const body = await readJson(request) as { url: string };
        try {
          // Parse GitHub URL
          const urlMatch = body.url.match(/github\.com\/([^/]+)\/([^/\s]+)/);
          if (!urlMatch) return send(response, 400, { error: "仅支持 GitHub URL" });
          const [, owner, repo] = urlMatch;
          const cleanRepo = repo.replace(/\.git$/, "");

          // Fetch repo info
          const repoResp = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}`);
          const repoData = await repoResp.json() as any;

          // Fetch README for description
          let readmeContent = "";
          try {
            const readmeResp = await fetch(`https://raw.githubusercontent.com/${owner}/${cleanRepo}/main/README.md`);
            if (readmeResp.ok) readmeContent = await readmeResp.text();
          } catch {}

          const skill = {
            id: `github-${owner}-${cleanRepo}`,
            name: cleanRepo,
            nameZh: cleanRepo,
            description: repoData.description || readmeContent.slice(0, 200),
            descriptionZh: repoData.description || readmeContent.slice(0, 200),
            author: owner,
            repo: `https://github.com/${owner}/${cleanRepo}`,
            category: "Custom",
            categoryZh: "自定义",
            stars: repoData.stargazers_count ?? 0,
            installed: true,
            source: "github",
            content: readmeContent.slice(0, 5000),
            installedAt: new Date().toISOString(),
          };

          // Add if not exists
          if (!installedSkills.find((s) => s.id === skill.id)) {
            installedSkills.push(skill);
          } else {
            installedSkills = installedSkills.map((s) => s.id === skill.id ? skill : s);
          }
          await mkdir(dataDir, { recursive: true });
          await fsWriteFile(skillsFile, JSON.stringify(installedSkills, null, 2));
          return send(response, 200, skill);
        } catch (err) {
          return send(response, 500, { error: err instanceof Error ? err.message : "安装失败" });
        }
      }

      if (request.method === "POST" && path === "/api/skills/search") {
        const body = await readJson(request) as { query: string };
        try {
          const searchResp = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(body.query)}&sort=stars&order=desc&per_page=20`, {
            headers: { "Accept": "application/vnd.github.v3+json" },
          });
          const data = await searchResp.json() as any;
          const results = (data.items ?? []).map((item: any) => ({
            id: `github-${item.owner.login}-${item.name}`,
            name: item.name,
            nameZh: item.name,
            description: item.description ?? "",
            descriptionZh: item.description ?? "",
            author: item.owner.login,
            repo: item.html_url,
            category: "Search",
            categoryZh: "搜索结果",
            stars: item.stargazers_count,
            installed: installedSkills.some((s) => s.id === `github-${item.owner.login}-${item.name}`),
            source: "github",
          }));
          return send(response, 200, results);
        } catch (err) {
          return send(response, 500, { error: "搜索失败" });
        }
      }

      if (request.method === "POST" && path === "/api/skills/import-local") {
        const body = await readJson(request) as { name: string; content: string; description?: string };
        if (!body.name || !body.content) return send(response, 400, { error: "名称和内容不能为空" });
        if (body.content.length > 100000) return send(response, 400, { error: "内容过长，最大 100KB" });
        const skill = {
          id: `local-${Date.now()}`,
          name: body.name,
          nameZh: body.name,
          description: body.description ?? body.content.slice(0, 200),
          descriptionZh: body.description ?? body.content.slice(0, 200),
          author: "本地导入",
          category: "Local",
          categoryZh: "本地导入",
          installed: true,
          source: "local",
          content: body.content,
          installedAt: new Date().toISOString(),
        };
        installedSkills.push(skill);
        await mkdir(dataDir, { recursive: true });
        await fsWriteFile(skillsFile, JSON.stringify(installedSkills, null, 2));
        return send(response, 200, skill);
      }

      // ─── Agent TTS Configs ─────────────────────────────
      if (request.method === "GET" && path === "/api/agent-tts-configs") {
        return send(response, 200, agentTTSConfigs);
      }
      if (request.method === "PUT" && path === "/api/agent-tts-configs") {
        const body = await readJson(request) as { configs: typeof agentTTSConfigs };
        if (body.configs) {
          agentTTSConfigs = body.configs;
          await saveAgentTTSConfigsToDisk();
        }
        return send(response, 200, { ok: true });
      }

      // ─── TTS Providers CRUD ────────────────────────────
      if (request.method === "GET" && path === "/api/tts-providers") {
        return send(response, 200, ttsProviders);
      }
      if (request.method === "PUT" && path === "/api/tts-providers") {
        const body = await readJson(request) as { providers: TTSProviderConfig[] };
        if (body.providers) {
          ttsProviders = body.providers;
          await saveTTSProvidersToDisk();
        }
        return send(response, 200, { ok: true });
      }

      // ─── TTS (Generic) ──────────────────────────────────
      if (request.method === "POST" && path === "/api/tts") {
        const body = await readJson(request) as {
          text: string;
          stylePrompt?: string;
          voice?: string;
          format?: string;
          speed?: number;
          ttsProviderId?: string;
          model?: string;
          agentId?: string;
          instructions?: string;
        };

        // Find TTS provider: explicit ID > per-agent config > first enabled
        const agentTTS = body.agentId ? agentTTSConfigs.find((c) => c.agentId === body.agentId) : undefined;
        const providerId = body.ttsProviderId ?? agentTTS?.ttsProviderId;
        const ttsProvider = (providerId ? ttsProviders.find((p) => p.id === providerId) : null) ??
          ttsProviders.find((p) => p.enabled && p.apiKey) ??
          ttsProviders.find((p) => p.enabled);  // Edge TTS doesn't need API key
        if (!ttsProvider) return send(response, 400, { error: "No TTS provider configured. Please set up a TTS provider in Settings." });

        try {
          const result = await callTTS({
            text: body.text,
            ttsProvider,
            voice: body.voice ?? agentTTS?.voice,
            model: body.model ?? agentTTS?.model,
            format: (body.format ?? "wav") as "wav" | "mp3" | "pcm16",
            speed: body.speed ?? agentTTS?.speed,
            stylePrompt: body.stylePrompt ?? agentTTS?.stylePrompt,
            instructions: body.instructions,
          });
          return send(response, 200, result);
        } catch (err) {
          return send(response, 500, { error: err instanceof Error ? err.message : String(err) });
        }
      }

      // ─── File Extract ─────────────────────────────────
      if (request.method === "POST" && path === "/api/extract-file") {
        const body = await readJson(request) as { fileName: string; fileType: string; base64Data: string };
        try {
          const result = await extractFileContent(body.fileName, body.fileType, body.base64Data);
          return send(response, 200, result);
        } catch (err) {
          return send(response, 500, { error: err instanceof Error ? err.message : String(err) });
        }
      }

      // ─── 404 ─────────────────────────────────────────
      return send(response, 404, { error: "not found" });
    } catch (error) {
      if (!response.headersSent) {
        return send(response, 500, { error: error instanceof Error ? error.message : String(error) });
      }
    }
  });
}

// ─── Start ──────────────────────────────────────────────────────

// ─── Global error handlers ────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught exception:", err.message);
  // Don't crash — keep serving
});

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled rejection:", reason);
  // Don't crash — keep serving
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.AGENT_API_PORT ?? 8787);
  const server = await createServer();
  server.on("error", (err) => {
    console.error("[SERVER] Error:", err.message);
  });
  // Auto-consolidation timer: every 10 minutes
  setInterval(async () => {
    try {
      consolidateMemories(memory);
      evictExpiredMemories(memory);
      await saveMemoryToDisk();
    } catch {}
  }, 10 * 60 * 1000);

  server.listen(port, "127.0.0.1", () => {
    console.log(`Agent API v0.3.0 listening on http://127.0.0.1:${port}`);
  });
}
