import { useEffect, useState, Component, type ReactNode } from "react";
import {
  Bot, Code2, Database, Download, FolderOpen, Loader2, MessageSquare, MessageSquarePlus, PackagePlus,
  PanelLeftClose, PanelLeftOpen, Pencil, Pin, Search, Settings, Trash2, Users,
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
import { SkillsView } from "./views/SkillsView";
import { MemoryView } from "./views/MemoryView";
import type { AgentTTSConfig, ModelConfig, ProviderConfig, Skill, TTSProviderConfig } from "./core/types";
import { getFallbackModels } from "./core/modelGateway";
import { useKeyboard } from "./lib/useKeyboard";
import { SunIcon, MoonIcon, BotIcon, UserIcon, ChatIcon } from "./components/icons";
import { SetupWizard } from "./views/SetupWizard";

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
    agents, setAgents, setAgentModelConfigs, setAgentTTSConfigs, setTTSProviders, setSkills,
    setSelectedAgentId,
    setServerConnected, serverConnected, createConversation, deleteConversation, pinConversation,
    toast, darkMode, toggleDarkMode,
  } = store;

  useKeyboard();

  const [setupDone, setSetupDone] = useState(() => localStorage.getItem("flowith-setup-done") === "true");
  const [convSearch, setConvSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  const exportConversation = (conv: typeof conversations[0]) => {
    const md = `# ${conv.title}\n\n` + conv.messages.map((m) => {
      const role = m.role === "user" ? "User" : m.agentName ? `${m.agentName}` : "Assistant";
      return `### ${role}\n${m.content}\n`;
    }).join("\n---\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${conv.title}.md`; a.click();
    URL.revokeObjectURL(url);
  };

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
        // TTS Providers
        const tpResp = await apiFetch("/api/tts-providers");
        if (tpResp.ok) { const d = await tpResp.json() as TTSProviderConfig[]; if (Array.isArray(d) && d.length > 0) setTTSProviders(d); }
      } catch {}

      try {
        // Skills
        const sResp = await apiFetch("/api/skills");
        if (sResp.ok) { const d = await sResp.json() as Skill[]; if (Array.isArray(d)) setSkills(d); }
      } catch {}

      try {
        // Agent model configs
        const amResp = await apiFetch("/api/agent-models");
        if (amResp.ok) { const d = await amResp.json(); if (Array.isArray(d)) setAgentModelConfigs(d); }
      } catch {}

      // Discover models for enabled providers
      // Re-fetch providers from API to ensure we have latest (closure may have stale data)
      let freshProviders = providers;
      try {
        const fpResp = await apiFetch("/api/providers");
        if (fpResp.ok) {
          const fpData = await fpResp.json();
          if (Array.isArray(fpData) && fpData.length > 0) freshProviders = fpData;
        }
      } catch {}
      for (const p of freshProviders.filter((pp: ProviderConfig) => pp.enabled && (pp.apiKey || pp.type === "ollama"))) {
        try {
          const resp = await apiFetch("/api/providers/discover", { method: "POST", body: JSON.stringify({ providerId: p.id }) });
          if (resp.ok) {
            const data = await resp.json() as { models: ModelConfig[]; count: number };
            setModels((prev) => {
              const custom = prev.filter((m) => m.providerId === p.id && m.source === "custom");
              const discovered = data.models.filter((dm) => !custom.some((cm) => cm.id === dm.id));
              return [...prev.filter((m) => m.providerId !== p.id), ...custom, ...discovered];
            });
          } else {
            // Discovery failed — use fallback models
            const fallbacks = getFallbackModels(p);
            setModels((prev) => {
              const existing = prev.filter((m) => m.providerId === p.id);
              if (existing.length === 0) return [...prev, ...fallbacks];
              return prev;
            });
          }
        } catch {
          // Discovery error — use fallback models
          const fallbacks = getFallbackModels(p);
          setModels((prev) => {
            const existing = prev.filter((m) => m.providerId === p.id);
            if (existing.length === 0) return [...prev, ...fallbacks];
            return prev;
          });
        }
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

  if (!setupDone) return <SetupWizard onComplete={() => setSetupDone(true)} />;

  return (
    <ErrorBoundary>
      <div className="app-shell" data-theme={darkMode ? "dark" : "light"}>
        <div className="topbar">
          <div className="topbar-left">
            <button className="icon-btn" onClick={toggleSidebar}>
              {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
            </button>
            <div className="topbar-title">
              <div className="logo">F</div>
              Flowith
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
              {darkMode ? <SunIcon size={16} /> : <MoonIcon size={16} />}
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
                <button className={`nav-item ${view === "skills" ? "active" : ""}`} onClick={() => setView("skills")}><PackagePlus size={16} /> Skills</button>
                <button className={`nav-item ${view === "memory" ? "active" : ""}`} onClick={() => setView("memory")}><Database size={16} /> 记忆</button>
                <button className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}><Settings size={16} /> 设置</button>
              </div>
              <div className="sidebar-section">对话历史</div>
              {/* 快速 1v1：横向头像行 */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px 4px", flexShrink: 0, overflowX: "auto" }}>
                <button className="quick-chat-avatar" title="自由对话（无预设）" onClick={() => { createConversation("chat", "自由对话"); setSelectedAgentId(""); setView("chat"); }}><ChatIcon size={18} /></button>
                {agents.map((a) => (
                  <button key={a.id} className="quick-chat-avatar" title={a.name} onClick={() => { (() => { const c = createConversation("chat", `与${a.name}对话`); c.agentIds = [a.id]; return c; })(); setSelectedAgentId(a.id); setView("chat"); }}>
                    {a.avatar}
                  </button>
                ))}
              </div>
              <button className="nav-item" onClick={() => createConversation()} style={{ margin: "0 8px 4px" }}><MessageSquarePlus size={14} /> 新对话</button>
              <div style={{ padding: "0 8px 4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)" }}>
                  <Search size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <input placeholder="搜索对话..." value={convSearch} onChange={(e) => setConvSearch(e.target.value)} style={{ border: "none", background: "transparent", fontSize: 12, flex: 1, outline: "none", color: "var(--text)" }} />
                </div>
                {/* Agent 筛选 */}
                {agents.length > 0 && (
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
                    <button onClick={() => setAgentFilter(null)} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, border: `1px solid ${agentFilter === null ? "var(--primary)" : "var(--border)"}`, background: agentFilter === null ? "var(--primary)" : "transparent", color: agentFilter === null ? "#fff" : "var(--text-muted)", cursor: "pointer" }}>全部</button>
                    {agents.map((a) => (
                      <button key={a.id} onClick={() => setAgentFilter(agentFilter === a.id ? null : a.id)} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, border: `1px solid ${agentFilter === a.id ? "var(--primary)" : "var(--border)"}`, background: agentFilter === a.id ? "var(--primary)" : "transparent", color: agentFilter === a.id ? "#fff" : "var(--text-muted)", cursor: "pointer" }}>{a.avatar} {a.name}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="conversation-list">
                {[...conversations].sort((a, b) => { if (a.pinned && !b.pinned) return -1; if (!a.pinned && b.pinned) return 1; return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(); }).filter((c) => (!convSearch || c.title.toLowerCase().includes(convSearch.toLowerCase()) || c.messages.some((m) => m.content.toLowerCase().includes(convSearch.toLowerCase()))) && (!agentFilter || c.agentIds.includes(agentFilter))).map((c) => (
                  <div key={c.id} className={`conv-item ${store.activeConvId === c.id ? "active" : ""} ${c.pinned ? "pinned" : ""}`} onClick={() => { store.setActiveConvId(c.id); setView("chat"); }}>
                    {c.pinned && <Pin size={10} style={{ color: "var(--primary)", flexShrink: 0 }} />}
                    {renamingConvId === c.id ? (
                      <input value={renameText} onChange={(e) => setRenameText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { store.setConversations((prev) => prev.map((x) => x.id === c.id ? { ...x, title: renameText } : x)); setRenamingConvId(null); store.showToast("已重命名", "success"); } if (e.key === "Escape") setRenamingConvId(null); }} onBlur={() => { store.setConversations((prev) => prev.map((x) => x.id === c.id ? { ...x, title: renameText } : x)); setRenamingConvId(null); }} onClick={(e) => e.stopPropagation()} autoFocus style={{ flex: 1, padding: "1px 4px", borderRadius: 4, border: "1px solid var(--primary)", background: "var(--bg)", color: "var(--text)", fontSize: 12, outline: "none" }} />
                    ) : (
                      <span className="conv-title">{c.title}</span>
                    )}
                    <span className="conv-type">{c.type === "roundtable" ? "圆桌" : c.type === "group-chat" ? "群聊" : c.branchedFrom ? "分支" : "对话"}</span>
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setRenamingConvId(c.id); setRenameText(c.title); }} title="重命名" style={{ padding: "2px 4px" }}><Pencil size={10} /></button>
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); pinConversation(c.id); }} title={c.pinned ? "取消置顶" : "置顶"} style={{ padding: "2px 4px", color: c.pinned ? "var(--primary)" : "var(--text-muted)" }}><Pin size={10} /></button>
                    <button className="icon-btn" onClick={(e) => { e.stopPropagation(); exportConversation(c); }} title="导出" style={{ padding: "2px 4px" }}><Download size={10} /></button>
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
            {view === "skills" && <SkillsView />}
            {view === "memory" && <MemoryView />}
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
