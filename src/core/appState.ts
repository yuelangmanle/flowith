import type { AgentConfig, ApprovalRequest, Conversation, ProviderConfig, ModelConfig, AppView } from "./types";
import { createDefaultProviders } from "./modelGateway";
import { loadConversations, loadProviders, saveProviders, saveConversation } from "./persistence";
import { DEFAULT_AGENTS } from "./agentConfig";

export interface AppState {
  activeView: AppView;
  providers: ProviderConfig[];
  models: ModelConfig[];
  conversations: Conversation[];
  activeConversationId: string | null;
  agents: AgentConfig[];
  approvals: ApprovalRequest[];
  sidebarOpen: boolean;
}

export type AppAction =
  | { type: "set-view"; view: AppView }
  | { type: "set-conversations"; conversations: Conversation[] }
  | { type: "set-active-conversation"; id: string | null }
  | { type: "update-provider"; provider: ProviderConfig }
  | { type: "set-models"; models: ModelConfig[] }
  | { type: "set-agents"; agents: AgentConfig[] }
  | { type: "toggle-sidebar" };

export function createInitialAppState(): AppState {
  const savedProviders = loadProviders();
  const providers = savedProviders ?? createDefaultProviders();
  return {
    activeView: "chat",
    providers,
    models: [],
    conversations: loadConversations(),
    activeConversationId: null,
    agents: [...DEFAULT_AGENTS],
    approvals: [],
    sidebarOpen: true,
  };
}

export function reduceAppState(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "set-view":
      return { ...state, activeView: action.view };
    case "set-conversations":
      return { ...state, conversations: action.conversations };
    case "set-active-conversation":
      return { ...state, activeConversationId: action.id };
    case "update-provider": {
      const updated = state.providers.map((p) =>
        p.id === action.provider.id ? action.provider : p
      );
      saveProviders(updated);
      return { ...state, providers: updated };
    }
    case "set-models":
      return { ...state, models: action.models };
    case "set-agents":
      return { ...state, agents: action.agents };
    case "toggle-sidebar":
      return { ...state, sidebarOpen: !state.sidebarOpen };
    default:
      return state;
  }
}
