/**
 * Mobile Bootstrap
 *
 * Initializes the DirectApiAdapter with route handlers when running
 * in mobile/Capacitor mode. This bridges the API adapter to the
 * core TypeScript business logic without needing a Node.js server.
 */

import { getDirectAdapter, setAdapter } from "./apiAdapter";
import { mobileStorage } from "./mobilePersistence";
import {
  createAppState,
  handleHealth,
  handleGetProviders,
  handlePutProviders,
  handleGetAgents,
  handleCreateAgent,
  handleDeleteAgent,
  handleGetConversations,
  handlePutConversations,
  handleCreateConversation,
  handleGetAgentModels,
  handlePutAgentModels,
  handleGetAgentTTSConfigs,
  handlePutAgentTTSConfigs,
  handleGetTTSProviders,
  handlePutTTSProviders,
  handleGetSkills,
  handlePutSkills,
  handleGetMemory,
  handleMemoryQuery,
  handleMemoryAdd,
  handleMemoryConsolidate,
  handleMemoryStats,
  handleMemoryExport,
  handleMemoryImport,
  handleMemoryClear,
  handleDeleteMemory,
  handleGetFallbackModels,
  handleTTS,
  handleChatStream,
  handleRoundtableStream,
  handleSequentialStream,
  handleHierarchicalStream,
  handleTestProvider,
  handleDiscoverModels,
  handleInstallSkillGithub,
  handleRefreshStars,
  handleCodeGenStream,
  type AppState,
  type StreamEvent,
} from "../core/apiHandlers";
import type { Conversation, ProviderConfig, AgentConfig, TTSProviderConfig, MemoryItem } from "../core/types";
import type { MemoryStore } from "../core/memoryKnowledge";

let state: AppState | null = null;

async function getState(): Promise<AppState> {
  if (state) return state;

  state = createAppState();

  // Load persisted data from IndexedDB
  try {
    const providers = await mobileStorage.getProviders<ProviderConfig[]>();
    if (providers && Array.isArray(providers) && providers.length > 0) state.providers = providers;
  } catch {}

  try {
    const conversations = await mobileStorage.getConversations<Conversation[]>();
    if (conversations && Array.isArray(conversations)) {
      for (const conv of conversations) state.conversations.set(conv.id, conv);
    }
  } catch {}

  try {
    const agents = await mobileStorage.getAgents<AgentConfig[]>();
    if (agents && Array.isArray(agents) && agents.length > 0) state.agents = agents;
  } catch {}

  try {
    const memory = await mobileStorage.getMemory<MemoryStore>();
    if (memory) Object.assign(state.memory, memory);
  } catch {}

  try {
    const skills = await mobileStorage.getSkills();
    if (skills && Array.isArray(skills)) state.installedSkills = skills as any[];
  } catch {}

  try {
    const agentModels = await mobileStorage.getAgentModels();
    if (agentModels && Array.isArray(agentModels)) state.agentModelConfigs = agentModels as any[];
  } catch {}

  try {
    const agentTTS = await mobileStorage.getAgentTTSConfigs();
    if (agentTTS && Array.isArray(agentTTS)) state.agentTTSConfigs = agentTTS as any[];
  } catch {}

  try {
    const ttsProviders = await mobileStorage.getTTSProviders<TTSProviderConfig[]>();
    if (ttsProviders && Array.isArray(ttsProviders) && ttsProviders.length > 0) state.ttsProviders = ttsProviders;
  } catch {}

  // Wire up persistence callbacks
  state.saveConversations = async () => {
    if (state) await mobileStorage.saveConversations(Array.from(state.conversations.values()));
  };
  state.saveProviders = async () => {
    if (state) await mobileStorage.saveProviders(state.providers);
  };
  state.saveMemory = async () => {
    if (state) await mobileStorage.saveMemory(state.memory);
  };
  state.saveSkills = async () => {
    if (state) await mobileStorage.saveSkills(state.installedSkills);
  };
  state.saveAgents = async () => {
    if (state) await mobileStorage.saveAgents(state.agents);
  };
  state.saveAgentModels = async () => {
    if (state) await mobileStorage.saveAgentModels(state.agentModelConfigs);
  };
  state.saveAgentTTSConfigs = async () => {
    if (state) await mobileStorage.saveAgentTTSConfigs(state.agentTTSConfigs);
  };
  state.saveTTSProviders = async () => {
    if (state) await mobileStorage.saveTTSProviders(state.ttsProviders);
  };

  return state;
}

/** Route non-streaming requests to handlers */
async function routeHandler(path: string, method: string, body: unknown): Promise<unknown> {
  const s = await getState();
  const b = body as any;

  // Health
  if (method === "GET" && path === "/api/health") return handleHealth(s);

  // Providers
  if (method === "GET" && path === "/api/providers") return handleGetProviders(s);
  if (method === "PUT" && path === "/api/providers") return handlePutProviders(s, b);

  // Agents
  if (method === "GET" && path === "/api/agents") return handleGetAgents(s);
  if (method === "POST" && path === "/api/agents") return handleCreateAgent(s, b);

  // Conversations
  if (method === "GET" && path === "/api/conversations") return handleGetConversations(s);
  if (method === "PUT" && path === "/api/conversations") return handlePutConversations(s, b);
  if (method === "POST" && path === "/api/conversations") return handleCreateConversation(s, b);

  // Agent models
  if (method === "GET" && path === "/api/agent-models") return handleGetAgentModels(s);
  if (method === "PUT" && path === "/api/agent-models") return handlePutAgentModels(s, b);

  // Agent TTS configs
  if (method === "GET" && path === "/api/agent-tts-configs") return handleGetAgentTTSConfigs(s);
  if (method === "PUT" && path === "/api/agent-tts-configs") return handlePutAgentTTSConfigs(s, b);

  // TTS Providers
  if (method === "GET" && path === "/api/tts-providers") return handleGetTTSProviders(s);
  if (method === "PUT" && path === "/api/tts-providers") return handlePutTTSProviders(s, b);

  // Skills
  if (method === "GET" && path === "/api/skills") return handleGetSkills(s);
  if (method === "PUT" && path === "/api/skills") return handlePutSkills(s, b);

  // Memory
  if (method === "GET" && path === "/api/memory") return handleGetMemory(s);
  if (method === "POST" && path === "/api/memory/query") return handleMemoryQuery(s, b);
  if (method === "POST" && path === "/api/memory/add") return handleMemoryAdd(s, b);
  if (method === "POST" && path === "/api/memory/consolidate") return handleMemoryConsolidate(s);
  if (method === "GET" && path === "/api/memory/stats") return handleMemoryStats(s);
  if (method === "POST" && path === "/api/memory/export") return handleMemoryExport(s);
  if (method === "POST" && path === "/api/memory/import") return handleMemoryImport(s, b);
  if (method === "DELETE" && path === "/api/memory/clear") return handleMemoryClear(s);

  // Models
  if (method === "GET" && path === "/api/models/fallback") return handleGetFallbackModels(s);

  // TTS
  if (method === "POST" && path === "/api/tts") return handleTTS(s, b);

  // Provider test & discover
  if (method === "POST" && path === "/api/test-provider") return handleTestProvider(s, b);
  if (method === "POST" && path.startsWith("/api/discover/")) return handleDiscoverModels(s, { providerId: path.split("/").pop()! });
  if (method === "POST" && path === "/api/providers/test") return handleTestProvider(s, b);
  if (method === "POST" && path === "/api/providers/discover") return handleDiscoverModels(s, b);

  // Agent delete
  if (method === "DELETE" && path.startsWith("/api/agents/")) return handleDeleteAgent(s, path.split("/").pop()!);

  // Memory delete single
  if (method === "DELETE" && path.startsWith("/api/memory/") && path !== "/api/memory/clear") return handleDeleteMemory(s, path.split("/").pop()!);

  // Skills install & refresh
  if (method === "POST" && path === "/api/skills/install-github") return handleInstallSkillGithub(s, b);
  if (method === "POST" && path === "/api/skills/refresh-stars") return handleRefreshStars(s);

  throw new Error(`Unknown route: ${method} ${path}`);
}

/** Route streaming requests to async generators */
async function* streamRouteHandler(path: string, body: unknown): AsyncGenerator<StreamEvent> {
  const s = await getState();
  const b = body as any;

  if (path === "/api/chat") yield* handleChatStream(s, b);
  else if (path === "/api/roundtable") yield* handleRoundtableStream(s, b);
  else if (path === "/api/orchestrate/sequential") yield* handleSequentialStream(s, b);
  else if (path === "/api/orchestrate/hierarchical") yield* handleHierarchicalStream(s, b);
  else if (path === "/api/codegen") yield* handleCodeGenStream(s, b);
  else yield { type: "error", data: { error: `Unknown stream route: ${path}` } };
}

/**
 * Bootstrap mobile mode: initialize the DirectApiAdapter with route handlers.
 * Call this early in app startup when running in Capacitor/mobile.
 */
export async function bootstrapMobile(): Promise<void> {
  const adapter = getDirectAdapter();
  adapter.setRouteHandler(routeHandler);
  adapter.setStreamRouteHandler(streamRouteHandler);
  setAdapter(adapter);
  console.log("[Mobile] DirectApiAdapter initialized");
}
