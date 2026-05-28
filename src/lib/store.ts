import { create } from "zustand";
import { createDefaultProviders, getFallbackModels } from "../core/modelGateway";
import { loadProviders, saveProviders, loadConversations, saveConversation, deleteConversation as deleteConv } from "../core/persistence";
import { DEFAULT_AGENTS } from "../core/agentConfig";
import { apiFetch, uid } from "./shared";
import type { AgentConfig, AgentTTSConfig, ChatMessage, Conversation, ModelConfig, ProviderConfig } from "../core/types";

// ─── Types ─────────────────────────────────────────────────────

export type View = "chat" | "settings" | "roundtable" | "projects" | "codegen" | "agents";
export type RightTab = "agents" | "models" | "info";

interface AgentModelConfig {
  agentId: string;
  providerId: string;
  modelId: string;
  useGlobal?: boolean;
}

// ─── Store ─────────────────────────────────────────────────────

interface AppState {
  // Navigation
  view: View;
  setView: (v: View) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  rightTab: RightTab;
  setRightTab: (t: RightTab) => void;

  // Providers & Models
  providers: ProviderConfig[];
  setProviders: (p: ProviderConfig[] | ((prev: ProviderConfig[]) => ProviderConfig[])) => void;
  models: ModelConfig[];
  setModels: (m: ModelConfig[] | ((prev: ModelConfig[]) => ModelConfig[])) => void;

  // Conversations
  conversations: Conversation[];
  setConversations: (c: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  activeConvId: string | null;
  setActiveConvId: (id: string | null) => void;

  // Agents
  agents: AgentConfig[];
  setAgents: (a: AgentConfig[] | ((prev: AgentConfig[]) => AgentConfig[])) => void;

  // Per-agent model configs
  agentModelConfigs: AgentModelConfig[];
  setAgentModelConfigs: (c: AgentModelConfig[]) => void;

  // Per-agent TTS configs
  agentTTSConfigs: AgentTTSConfig[];
  setAgentTTSConfigs: (c: AgentTTSConfig[]) => void;

  // Global chat selections
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
  selectedProviderId: string;
  setSelectedProviderId: (id: string) => void;
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;

  // TTS
  ttsEnabled: boolean;
  setTtsEnabled: (v: boolean) => void;
  ttsPlaying: boolean;
  setTtsPlaying: (v: boolean) => void;

  // Server
  serverConnected: boolean;
  setServerConnected: (v: boolean) => void;

  // Toast
  toast: { message: string; type: "success" | "error" | "info" } | null;
  showToast: (message: string, type?: "success" | "error" | "info") => void;

  // Theme
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Helpers
  getEffectiveConfig: (agentId: string) => { providerId: string; modelId: string; provider: ProviderConfig | undefined };
  syncProvidersToServer: () => void;
  syncConversationsToServer: () => void;
  createConversation: (type?: Conversation["type"], title?: string) => Conversation;
  deleteConversation: (id: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Navigation
  view: "chat",
  setView: (v) => set({ view: v }),
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  rightPanelOpen: true,
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  rightTab: "agents",
  setRightTab: (t) => set({ rightTab: t }),

  // Providers & Models
  providers: loadProviders() ?? createDefaultProviders(),
  setProviders: (p) => set({ providers: typeof p === "function" ? p(get().providers) : p }),
  models: [],
  setModels: (m) => set({ models: typeof m === "function" ? m(get().models) : m }),

  // Conversations
  conversations: loadConversations(),
  setConversations: (c) => set({ conversations: typeof c === "function" ? c(get().conversations) : c }),
  activeConvId: null,
  setActiveConvId: (id) => set({ activeConvId: id }),

  // Agents
  agents: [...DEFAULT_AGENTS],
  setAgents: (a) => set({ agents: typeof a === "function" ? a(get().agents) : a }),

  // Per-agent configs
  agentModelConfigs: [],
  setAgentModelConfigs: (c) => set({ agentModelConfigs: c }),
  agentTTSConfigs: [],
  setAgentTTSConfigs: (c) => set({ agentTTSConfigs: c }),

  // Global selections
  selectedAgentId: "agent-moderator",
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
  selectedProviderId: "",
  setSelectedProviderId: (id) => set({ selectedProviderId: id }),
  selectedModelId: "",
  setSelectedModelId: (id) => set({ selectedModelId: id }),

  // TTS
  ttsEnabled: false,
  setTtsEnabled: (v) => set({ ttsEnabled: v }),
  ttsPlaying: false,
  setTtsPlaying: (v) => set({ ttsPlaying: v }),

  // Server
  serverConnected: false,
  setServerConnected: (v) => set({ serverConnected: v }),

  // Toast
  toast: null,
  showToast: (message, type = "info") => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },

  // Theme
  darkMode: false,
  toggleDarkMode: () => {
    const next = !get().darkMode;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    set({ darkMode: next });
  },

  // Helpers
  getEffectiveConfig: (agentId) => {
    const s = get();
    const agentCfg = s.agentModelConfigs.find((c) => c.agentId === agentId && !c.useGlobal);
    if (agentCfg) {
      return { providerId: agentCfg.providerId, modelId: agentCfg.modelId, provider: s.providers.find((p) => p.id === agentCfg.providerId) };
    }
    if (s.selectedProviderId && s.selectedModelId) {
      return { providerId: s.selectedProviderId, modelId: s.selectedModelId, provider: s.providers.find((p) => p.id === s.selectedProviderId) };
    }
    const fallback = s.providers.find((p) => p.enabled && (p.apiKey || p.type === "ollama"));
    if (fallback) {
      const fm = s.models.filter((m) => m.providerId === fallback.id);
      return { providerId: fallback.id, modelId: fm[0]?.id ?? fallback.defaultModel ?? "", provider: fallback };
    }
    return { providerId: "", modelId: "", provider: undefined };
  },

  syncProvidersToServer: () => {
    const p = get().providers;
    try { apiFetch("/api/providers", { method: "PUT", body: JSON.stringify({ providers: p }) }); } catch {}
  },
  syncConversationsToServer: () => {
    const c = get().conversations;
    try { apiFetch("/api/conversations", { method: "PUT", body: JSON.stringify({ conversations: c }) }); } catch {}
  },

  createConversation: (type = "chat", title = "新对话") => {
    const conv: Conversation = { id: uid(), title, type, agentIds: [], messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    set((s) => {
      const next = [conv, ...s.conversations];
      saveConversation(conv);
      try { apiFetch("/api/conversations", { method: "PUT", body: JSON.stringify({ conversations: next }) }); } catch {}
      return { conversations: next, activeConvId: conv.id };
    });
    return conv;
  },

  deleteConversation: (id) => {
    set((s) => {
      const next = s.conversations.filter((c) => c.id !== id);
      deleteConv(id);
      try { apiFetch("/api/conversations", { method: "PUT", body: JSON.stringify({ conversations: next }) }); } catch {}
      return { conversations: next, activeConvId: s.activeConvId === id ? null : s.activeConvId };
    });
  },
}));
