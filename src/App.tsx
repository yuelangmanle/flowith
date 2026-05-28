import { useEffect, Component, type ReactNode } from "react";
import {
  Bot, Code2, FolderOpen, Loader2, MessageSquare, MessageSquarePlus,
  PanelLeftClose, PanelLeftOpen, Settings, Trash2, Users,
} from "lucide-react";
import { useStore } from "./lib/store";
import { apiFetch } from "./lib/shared";
import { ChatView } from "./views/ChatView";
import { SettingsView } from "./views/SettingsView";
import { AgentsView } from "./views/AgentsView";
import { RoundtableView } from "./views/RoundtableView";
import { CodeGenView } from "./views/CodeGenView";
import { ProjectsView } from "./views/ProjectsView";
import { RightPanel } from "./views/RightPanel";
import type { AgentTTSConfig, ModelConfig } from "./core/types";
import { createDefaultProviders } from "./core/modelGateway";
import { useKeyboard } from "./lib/useKeyboard";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: "" };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error: error.message }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: "system-ui", color: "#2D3436", background: "#FAFBFC", minHeight: "100vh" }}>
          <h1 style={{ color: "#FF6B6B" }}>出错了</h1>
          <p>{this.state.error}</p>
          <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }} style={{ padding: "10px 20px", marginTop: 16, cursor: "pointer" }}>刷新</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const store = useStore();
  const {
    view, setView, sidebarOpen, toggleSidebar, rightPanelOpen, toggleRightPanel,
    providers, setProviders, models, setModels, conversations,
    agents, setAgents, setAgentModelConfigs, setAgentTTSConfigs,
    setServerConnected, serverConnected, createConversation, deleteConversation,
    toast, darkMode, toggleDarkMode,
  } = store;

  useKeyboard();

  // Server health + data loading
  useEffect(() => {
    const check = async () => {
      try {
        const resp = await apiFetch("/api/health");
        if (resp.ok) {
          setServerConnected(true);
          const data = await resp.json() as { providers?: number; agents?: number; conversations?: number };
          if (data.providers) { /* server has data */ }
        }
      } catch { setServerConnected(false); }
    };
    check();
    const interval = setInterval(check, 30000);

    // Load data from server
    (async () => {
      try {
        // Agents
        const aResp = await apiFetch("/api/agents");
        if (aResp.ok) { const d = await aResp.json(); if (Array.isArray(d) && d.length > 0) setAgents(d); }
      } catch {}

      try {
        // Providers
        const pResp = await apiFetch("/api/providers");
        if (pResp.ok) { const d = await pResp.json(); if (Array.isArray(d) && d.length > 0) setProviders(d); }
      } catch {}

      try {
        // Agent TTS configs
        const atResp = await apiFetch("/api/agent-tts-configs");
        if (atResp.ok) { const d = await atResp.json() as AgentTTSConfig[]; if (Array.isArray(d)) setAgentTTSConfigs(d); }
      } catch {}

      try {
        // Agent model configs
        const amResp = await apiFetch("/api/agent-models");
        if (amResp.ok) { const d = await amResp.json(); if (Array.isArray(d)) setAgentModelConfigs(d); }
      } catch {}

      // Discover models for enabled providers
      for (const p of providers.filter((pp) => pp.enabled && (pp.apiKey || pp.type === "ollama"))) {
        try {
          const resp = await apiFetch("/api/providers/discover", { method: "POST", body: JSON.stringify({ providerId: p.id }) });
          if (resp.ok) {
            const data = await resp.json() as { models: ModelConfig[]; count: number };
            setModels((prev) => [...prev.filter((m) => m.providerId !== p.id), ...data.models]);
          }
        } catch {}
      }

      // Load conversations from server
      try {
        const cResp = await apiFetch("/api/conversations");
        if (cResp.ok) {
          const d = await cResp.json();
          if (Array.isArray(d) && d.length > 0) {
            // Merge server conversations with local
            const existing = useStore.getState().conversations;
            const merged = [...d, ...existing.filter((c) => !d.some((s: { id: string }) => s.id === c.id))];
            useStore.setState({ conversations: merged });
          }
        }
      } catch {}
    })();

    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  return (
    <ErrorBoundary>
      <div className="app-shell" data-theme={darkMode ? "dark" : "light"}>
        <div className="topbar">
          <div className="topbar-left">
            <button className="icon-btn" onClick={toggleSidebar}>
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
            <div className="topbar-title">
              <div className="logo">M</div>
              Multi-Agent Workspace
            </div>
          </div>
          <div className="topbar-right">
            <div className="status-pills">
              <span className={`status-pill ${serverConnected ? "ok" : "warn"}`}>
                {serverConnected ? "● 已连接" : "○ 未连接"}
              </span>
              <span className="status-pill info">{providers.filter((p) => p.enabled).length} 供应商</span>
              <span className="status-pill info">{agents.length} Agents</span>
            </div>
            <button className="icon-btn" onClick={toggleDarkMode} title={darkMode ? "浅色模式" : "深色模式"}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button className="icon-btn" onClick={toggleRightPanel}>
              <PanelLeftOpen size={18} style={{ transform: "scaleX(-1)" }} />
            </button>
          </div>
        </div>

        <div className={`main-layout ${!sidebarOpen ? "sidebar-collapsed" : ""} ${!rightPanelOpen ? "right-collapsed" : ""} ${!sidebarOpen && !rightPanelOpen ? "both-collapsed" : ""}`}>
          {sidebarOpen && (
            <div className="sidebar">
              <div className="sidebar-nav">
                <button className={`nav-item ${view === "chat" ? "active" : ""}`} onClick={() => setView("chat")}><MessageSquare size={16} /> 对话</button>
                <button className={`nav-item ${view === "roundtable" ? "active" : ""}`} onClick={() => setView("roundtable")}><Users size={16} /> 圆桌会议</button>
                <button className={`nav-item ${view === "codegen" ? "active" : ""}`} onClick={() => setView("codegen")}><Code2 size={16} /> 代码生成</button>
                <button className={`nav-item ${view === "projects" ? "active" : ""}`} onClick={() => setView("projects")}><FolderOpen size={16} /> 项目模板</button>
                <button className={`nav-item ${view === "agents" ? "active" : ""}`} onClick={() => setView("agents")}><Bot size={16} /> Agent 管理</button>
                <button className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><Settings size={16} /> 设置</button>
              </div>
              <div className="sidebar-section">对话历史</div>
              <button className="nav-item" onClick={() => createConversation()} style={{ margin: "0 8px 4px" }}><MessageSquarePlus size={14} /> 新对话</button>
              <div className="conversation-list">
                {conversations.map((c) => (
                  <div key={c.id} className={`conv-item ${store.activeConvId === c.id ? "active" : ""}`} onClick={() => { store.setActiveConvId(c.id); setView("chat"); }}>
                    <span className="conv-title">{c.title}</span>
                    <span className="conv-type">{c.type === "roundtable" ? "圆桌" : c.type === "group-chat" ? "群聊" : "对话"}</span>
                    <button className="delete-btn" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="main-content">
            {view === "chat" && <ChatView />}
            {view === "roundtable" && <RoundtableView />}
            {view === "codegen" && <CodeGenView />}
            {view === "projects" && <ProjectsView />}
            {view === "settings" && <SettingsView />}
            {view === "agents" && <AgentsView />}
          </div>
          {rightPanelOpen && <RightPanel />}
        </div>
      </div>
      {toast && (
        <div style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 1000,
          padding: "10px 16px", borderRadius: 8,
          background: toast.type === "success" ? "rgba(107,203,119,0.95)" : toast.type === "error" ? "rgba(255,107,107,0.95)" : "rgba(77,150,255,0.95)",
          color: "white", fontSize: 13, fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)", animation: "fadeIn 0.2s ease-out",
        }}>
          {toast.message}
        </div>
      )}
    </ErrorBoundary>
  );
}
