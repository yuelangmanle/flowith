import { useEffect, useRef, useState, useCallback, type ReactNode, Component } from "react";
import {
  Activity, Bot, ChevronDown, ChevronRight, FolderOpen,
  Loader2, MessageSquare, MessageSquarePlus, PanelLeftClose,
  PanelLeftOpen, Play, Plus, RefreshCw, Send, Settings,
  ShieldCheck, Trash2, Users, X, Zap, Vote, FileText,
  Brain, Code2, Microscope, BookOpen, Square,
} from "lucide-react";
import { createDefaultProviders, getFallbackModels } from "./core/modelGateway";
import { loadProviders, saveProviders, loadConversations, saveConversation, deleteConversation as deleteConv } from "./core/persistence";
import { DEFAULT_AGENTS, createUserAgent } from "./core/agentConfig";
import type { AgentConfig, ChatMessage, Conversation, ModelConfig, ProviderConfig, VoteSession, StructuredReport } from "./core/types";
import { projectTemplates, appMetadata, roundtableTopics } from "./core/demoData";

const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? `http://${window.location.hostname}:8787`
  : `http://127.0.0.1:8787`;

function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

function formatTime(iso: string) {
  try { const d = new Date(iso); return `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`; } catch { return ""; }
}

async function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
}

async function syncProvidersToServer(providers: ProviderConfig[]) {
  try { await apiFetch("/api/providers", { method: "PUT", body: JSON.stringify({ providers }) }); } catch {}
}

async function syncConversationsToServer(conversations: Conversation[]) {
  try { await apiFetch("/api/conversations", { method: "PUT", body: JSON.stringify({ conversations }) }); } catch {}
}

type View = "chat" | "settings" | "roundtable" | "projects" | "codegen" | "agents";

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
  const [view, setView] = useState<View>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [providers, setProviders] = useState<ProviderConfig[]>(() => loadProviders() ?? createDefaultProviders());
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations());
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentConfig[]>(DEFAULT_AGENTS);
  const [serverConnected, setServerConnected] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingAgent, setStreamingAgent] = useState<{ id: string; name: string; color: string; avatar: string } | null>(null);
  const [rightTab, setRightTab] = useState<"agents" | "models" | "info">("agents");
  const [selectedAgentId, setSelectedAgentId] = useState("agent-moderator");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeConvId) ?? null;

  // Server health check
  useEffect(() => {
    const check = async () => {
      try {
        const resp = await apiFetch("/api/health");
        if (resp.ok) {
          setServerConnected(true);
          syncProvidersToServer(providers);
          syncConversationsToServer(conversations);
          // Load agents from server
          try {
            const agentResp = await apiFetch("/api/agents");
            if (agentResp.ok) {
              const serverAgents = await agentResp.json() as AgentConfig[];
              if (serverAgents.length > 0) setAgents(serverAgents);
            }
          } catch {}
          // Discover models for enabled providers
          for (const p of providers.filter((p) => p.enabled && (p.apiKey || p.type === "ollama"))) {
            try {
              const resp = await apiFetch("/api/providers/discover", { method: "POST", body: JSON.stringify({ providerId: p.id }) });
              if (resp.ok) {
                const data = await resp.json() as { models: ModelConfig[] };
                setModels((prev) => {
                  const existing = prev.filter((m) => m.providerId !== p.id);
                  return [...existing, ...data.models];
                });
              }
            } catch {}
          }
        }
      } catch { setServerConnected(false); }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (messagesEndRef.current?.scrollIntoView) messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages.length, streamingContent]);

  const updateConversations = useCallback((updated: Conversation[]) => {
    setConversations(updated);
    syncConversationsToServer(updated);
  }, []);

  const createConversation = useCallback((type: Conversation["type"] = "chat", title = "新对话") => {
    const conv: Conversation = { id: uid(), title, type, agentIds: [], messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const updated = [conv, ...conversations];
    setConversations(updated);
    setActiveConvId(conv.id);
    saveConversation(conv);
    syncConversationsToServer(updated);
    return conv;
  }, [conversations]);

  const deleteConversation = useCallback((id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    if (activeConvId === id) setActiveConvId(updated[0]?.id ?? null);
    deleteConv(id);
    syncConversationsToServer(updated);
  }, [conversations, activeConvId]);

  const sendChatMessage = useCallback(async (message: string) => {
    if (!message.trim() || streaming) return;

    let conv = activeConversation;
    if (!conv) {
      conv = createConversation("chat", message.slice(0, 30));
    }

    // Add user message
    const userMsg: ChatMessage = { id: uid(), role: "user", content: message, createdAt: new Date().toISOString() };
    const updatedMessages = [...conv.messages, userMsg];
    const updatedConv = { ...conv, messages: updatedMessages, updatedAt: new Date().toISOString() };
    const updatedConvs = conversations.map((c) => c.id === conv!.id ? updatedConv : c);
    setConversations(updatedConvs);
    saveConversation(updatedConv);

    setChatInput("");
    setStreaming(true);
    setStreamingContent("");
    setStreamingAgent(null);

    try {
      const resp = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ conversationId: conv.id, message, agentId: selectedAgentId }),
      });

      if (!resp.ok) {
        const err = await resp.json() as { error: string };
        throw new Error(err.error);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
            continue;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === "text" && data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
                if (data.agentName) setStreamingAgent({ id: data.agentId, name: data.agentName, color: data.agentColor, avatar: data.agentAvatar ?? "🤖" });
              } else if (currentEvent === "error") {
                throw new Error(data.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }

      // Add assistant message
      const agent = agents.find((a) => a.id === selectedAgentId);
      const assistantMsg: ChatMessage = {
        id: uid(), role: "assistant", content: fullContent || "(无响应)",
        agentId: agent?.id, agentName: agent?.name, agentColor: agent?.color,
        createdAt: new Date().toISOString(),
      };
      const finalMessages = [...updatedMessages, assistantMsg];
      const finalConv = { ...updatedConv, messages: finalMessages, updatedAt: new Date().toISOString() };
      const finalConvs = conversations.map((c) => c.id === conv!.id ? finalConv : c);
      setConversations(finalConvs);
      saveConversation(finalConv);
      syncConversationsToServer(finalConvs);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: uid(), role: "system", content: `错误: ${err instanceof Error ? err.message : String(err)}`,
        createdAt: new Date().toISOString(),
      };
      const finalMessages = [...updatedMessages, errorMsg];
      const finalConv = { ...updatedConv, messages: finalMessages, updatedAt: new Date().toISOString() };
      const finalConvs = conversations.map((c) => c.id === conv!.id ? finalConv : c);
      setConversations(finalConvs);
      saveConversation(finalConv);
    } finally {
      setStreaming(false);
      setStreamingContent("");
      setStreamingAgent(null);
    }
  }, [activeConversation, conversations, streaming, selectedAgentId, agents, createConversation]);

  // ─── View: Chat ───────────────────────────────────────
  const renderChat = () => (
    <div className="chat-container">
      <div className="chat-messages">
        {(!activeConversation || activeConversation.messages.length === 0) && (
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <div className="empty-text">开始对话</div>
            <div className="empty-hint">选择一个 Agent，输入消息开始交流</div>
            <div className="quick-actions" style={{ marginTop: 16 }}>
              {["帮我写一个 TODO 应用", "解释一下 React Hooks", "如何优化 Web 性能？"].map((q) => (
                <button key={q} className="quick-action-btn" onClick={() => sendChatMessage(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {activeConversation?.messages.map((msg) => (
          <div key={msg.id} className={`msg-row ${msg.role}`}>
            <div className="msg-avatar" style={{ background: msg.role === "user" ? "#4D96FF" : (msg.agentColor ?? "#4ECDC4") }}>
              {msg.role === "user" ? "👤" : (msg.agentAvatar ?? "🤖")}
            </div>
            <div>
              <div className="msg-bubble">
                {msg.agentName && <div className="msg-agent-name" style={{ color: msg.agentColor }}>{msg.agentAvatar} {msg.agentName}</div>}
                <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
              </div>
              <div className="msg-time">{formatTime(msg.createdAt)}</div>
            </div>
          </div>
        ))}
        {streaming && streamingContent && (
          <div className="msg-row assistant">
            <div className="msg-avatar" style={{ background: streamingAgent?.color ?? "#4ECDC4" }}>
              {streamingAgent?.avatar ?? "🤖"}
            </div>
            <div>
              <div className="msg-bubble">
                {streamingAgent && <div className="msg-agent-name" style={{ color: streamingAgent.color }}>{streamingAgent.avatar} {streamingAgent.name}<span className="streaming-dot" /></div>}
                <div style={{ whiteSpace: "pre-wrap" }}>{streamingContent}<span className="streaming-dot" /></div>
              </div>
            </div>
          </div>
        )}
        {streaming && !streamingContent && (
          <div className="msg-row assistant">
            <div className="msg-avatar" style={{ background: "#4ECDC4" }}>🤖</div>
            <div className="msg-bubble">
              <div className="typing-indicator"><span className="dot" /><span className="dot" /><span className="dot" /></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <textarea
            className="chat-input"
            placeholder={`与 ${agents.find((a) => a.id === selectedAgentId)?.name ?? "Agent"} 对话...`}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(chatInput); } }}
            rows={1}
            disabled={streaming}
          />
          <button className="primary" onClick={() => sendChatMessage(chatInput)} disabled={streaming || !chatInput.trim()} style={{ borderRadius: 10, padding: "10px 16px" }}>
            {streaming ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          </button>
        </div>
        <div className="agent-selector" style={{ marginTop: 8 }}>
          {agents.filter((a) => !a.custom || true).map((a) => (
            <button key={a.id} className={`agent-chip ${selectedAgentId === a.id ? "selected" : ""}`} onClick={() => setSelectedAgentId(a.id)}>
              <span>{a.avatar}</span> {a.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── View: Roundtable ─────────────────────────────────
  const [rtTopic, setRtTopic] = useState("");
  const [rtAgents, setRtAgents] = useState<string[]>(["agent-moderator", "agent-product", "agent-architecture", "agent-critic"]);
  const [rtRounds, setRtRounds] = useState(3);
  const [rtStreaming, setRtStreaming] = useState(false);
  const [rtMessages, setRtMessages] = useState<Array<{ agentId: string; agentName: string; agentColor: string; agentAvatar: string; content: string; round: number }>>([]);
  const [rtReport, setRtReport] = useState<StructuredReport | null>(null);

  const startRoundtable = useCallback(async () => {
    if (!rtTopic.trim() || rtStreaming) return;
    setRtStreaming(true);
    setRtMessages([]);
    setRtReport(null);

    const conv = createConversation("roundtable", `圆桌: ${rtTopic.slice(0, 20)}`);

    try {
      const resp = await apiFetch("/api/roundtable", {
        method: "POST",
        body: JSON.stringify({ topic: rtTopic, agentIds: rtAgents, rounds: rtRounds }),
      });

      if (!resp.ok) throw new Error("Roundtable failed");

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";
      let currentAgent: { id: string; name: string; color: string; avatar: string } | null = null;
      let currentContent = "";
      let currentRound = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
            continue;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === "text" && data.agentId && !data.content) {
                currentAgent = { id: data.agentId, name: data.agentName, color: data.agentColor, avatar: data.agentAvatar ?? "🤖" };
                currentContent = "";
                currentRound = data.round ?? 0;
              } else if (currentEvent === "text" && data.content) {
                currentContent += data.content;
                setRtMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.agentId === currentAgent?.id && last.round === currentRound) {
                    return [...prev.slice(0, -1), { ...last, content: currentContent }];
                  }
                  return [...prev, { agentId: currentAgent?.id ?? "", agentName: currentAgent?.name ?? "", agentColor: currentAgent?.color ?? "#4ECDC4", agentAvatar: currentAgent?.avatar ?? "🤖", content: currentContent, round: currentRound }];
                });
              } else if (currentEvent === "report") {
                setRtReport(data as StructuredReport);
              } else if (currentEvent === "error") {
                throw new Error(data.error);
              }
            } catch (e) {
              if (!(e instanceof SyntaxError)) throw e;
            }
          }
        }
      }
    } catch (err) {
      console.error("Roundtable error:", err);
    } finally {
      setRtStreaming(false);
    }
  }, [rtTopic, rtAgents, rtRounds, rtStreaming, createConversation]);

  const renderRoundtable = () => (
    <div className="chat-container">
      <div className="roundtable-header">
        <div className="roundtable-topic">
          <Users size={16} /> 圆桌会议
        </div>
        <div style={{ marginTop: 8 }}>
          <input
            className="chat-input"
            style={{ width: "100%", borderRadius: 8 }}
            placeholder="输入讨论主题..."
            value={rtTopic}
            onChange={(e) => setRtTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") startRoundtable(); }}
          />
        </div>
        <div className="roundtable-participants" style={{ marginTop: 8 }}>
          {agents.map((a) => (
            <button
              key={a.id}
              className={`participant-chip ${rtAgents.includes(a.id) ? "selected" : ""}`}
              onClick={() => setRtAgents((prev) => prev.includes(a.id) ? prev.filter((id) => id !== a.id) : [...prev, a.id])}
              style={rtAgents.includes(a.id) ? { background: a.color + "20", borderColor: a.color } : {}}
            >
              <span className="p-avatar" style={{ background: a.color }}>{a.avatar}</span>
              {a.name}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>轮数:</label>
          <select value={rtRounds} onChange={(e) => setRtRounds(Number(e.target.value))} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }}>
            {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button className="primary" onClick={startRoundtable} disabled={rtStreaming || !rtTopic.trim()}>
            {rtStreaming ? <><Loader2 size={14} className="spin" /> 讨论中...</> : <><Play size={14} /> 开始讨论</>}
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {rtMessages.length === 0 && !rtStreaming && (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-text">圆桌会议</div>
            <div className="empty-hint">选择参与者，输入主题，开始多 Agent 讨论</div>
            <div className="quick-actions" style={{ marginTop: 16 }}>
              {roundtableTopics.map((t) => (
                <button key={t.id} className="quick-action-btn" onClick={() => setRtTopic(t.name)}>{t.icon} {t.name}</button>
              ))}
            </div>
          </div>
        )}
        {rtMessages.map((msg, i) => (
          <div key={`${msg.agentId}-${i}`} className="msg-row assistant">
            <div className="msg-avatar" style={{ background: msg.agentColor }}>{msg.agentAvatar}</div>
            <div style={{ maxWidth: "80%" }}>
              <div className="msg-bubble">
                <div className="msg-agent-name" style={{ color: msg.agentColor }}>{msg.agentAvatar} {msg.agentName} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>第{msg.round + 1}轮</span></div>
                <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
              </div>
            </div>
          </div>
        ))}
        {rtStreaming && (
          <div className="msg-row assistant">
            <div className="msg-avatar" style={{ background: "#4ECDC4" }}>🤖</div>
            <div className="msg-bubble"><div className="typing-indicator"><span className="dot" /><span className="dot" /><span className="dot" /></div></div>
          </div>
        )}
        {rtReport && (
          <div className="report-card">
            <div className="report-header"><FileText size={14} /> {rtReport.title}</div>
            {rtReport.sections.map((s, i) => (
              <div key={i} className="report-section"><h4>{s.title}</h4><p>{s.content.slice(0, 300)}</p></div>
            ))}
            <div className="report-conclusion"><strong>结论:</strong> {rtReport.conclusion}</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );

  // ─── View: Projects (Templates) ───────────────────────
  const renderProjects = () => (
    <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
      <h3 style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        <FolderOpen size={18} /> 项目模板
      </h3>
      <div className="templates-grid">
        {projectTemplates.map((t) => (
          <div key={t.id} className="template-card" onClick={() => { setRtTopic(t.idea); setView("codegen"); }}>
            <div className="t-icon">{t.icon}</div>
            <div className="t-name">{t.name}</div>
            <div className="t-stack">{t.stack}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── View: Code Generation ────────────────────────────
  const [cgIdea, setCgIdea] = useState("");
  const [cgStack, setCgStack] = useState("Vite + React + TypeScript");
  const [cgStreaming, setCgStreaming] = useState(false);
  const [cgMessages, setCgMessages] = useState<Array<{ phase: string; content: string; agentName: string }>>([]);
  const [cgPhase, setCgPhase] = useState("");

  const startCodeGen = useCallback(async () => {
    if (!cgIdea.trim() || cgStreaming) return;
    setCgStreaming(true);
    setCgMessages([]);
    setCgPhase("requirements");

    try {
      const resp = await apiFetch("/api/codegen", {
        method: "POST",
        body: JSON.stringify({ idea: cgIdea, techStack: cgStack }),
      });

      if (!resp.ok) throw new Error("Codegen failed");

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";
      let currentPhase = "";
      let currentContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
            continue;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === "text" && data.content) {
                currentContent += data.content;
                setCgMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.phase === currentPhase) {
                    return [...prev.slice(0, -1), { ...last, content: currentContent }];
                  }
                  return [...prev, { phase: currentPhase, content: currentContent, agentName: data.agentName ?? currentPhase }];
                });
              } else if (currentEvent === "text" && data.agentName && !data.content) {
                currentPhase = data.agentName;
                currentContent = "";
                setCgPhase(data.agentName);
              } else if (currentEvent === "progress" && data.phase) {
                currentPhase = data.phase;
                currentContent = "";
                setCgPhase(data.phase);
              } else if (currentEvent === "complete") {
                currentPhase = "";
              } else if (currentEvent === "error") {
                throw new Error(data.error);
              }
            } catch (e) {
              if (!(e instanceof SyntaxError)) throw e;
            }
          }
        }
      }
    } catch (err) {
      console.error("Codegen error:", err);
    } finally {
      setCgStreaming(false);
    }
  }, [cgIdea, cgStack, cgStreaming]);

  const renderCodeGen = () => (
    <div className="chat-container">
      <div className="roundtable-header">
        <div className="roundtable-topic"><Code2 size={16} /> 代码生成</div>
        <div style={{ marginTop: 8 }}>
          <textarea
            className="chat-input"
            style={{ width: "100%", borderRadius: 8, minHeight: 60 }}
            placeholder="描述你想要的应用..."
            value={cgIdea}
            onChange={(e) => setCgIdea(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          <select value={cgStack} onChange={(e) => setCgStack(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }}>
            <option>Vite + React + TypeScript</option>
            <option>Next.js + TypeScript</option>
            <option>Express + TypeScript</option>
          </select>
          <button className="primary" onClick={startCodeGen} disabled={cgStreaming || !cgIdea.trim()}>
            {cgStreaming ? <><Loader2 size={14} className="spin" /> 生成中...</> : <><Play size={14} /> 开始生成</>}
          </button>
        </div>
        <div className="codegen-timeline" style={{ marginTop: 8 }}>
          {["requirements", "design", "generation", "testing", "fixing", "documentation", "review"].map((phase) => {
            const phaseNames: Record<string, string> = { requirements: "需求分析", design: "技术设计", generation: "代码生成", testing: "测试验证", fixing: "修复问题", documentation: "文档生成", review: "最终审查" };
            const isActive = cgPhase === phase;
            const isDone = ["requirements", "design", "generation", "testing", "documentation", "review"].indexOf(phase) < ["requirements", "design", "generation", "testing", "documentation", "review"].indexOf(cgPhase);
            return (
              <div key={phase} className={`phase-step ${isActive ? "running" : isDone ? "completed" : "pending"}`}>
                <div className="phase-icon">{isDone ? "✓" : isActive ? <Loader2 size={12} className="spin" /> : "○"}</div>
                <span>{phaseNames[phase] ?? phase}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="chat-messages">
        {cgMessages.length === 0 && !cgStreaming && (
          <div className="empty-state">
            <div className="empty-icon">⚡</div>
            <div className="empty-text">代码生成</div>
            <div className="empty-hint">描述你的应用想法，AI 团队会帮你从需求到代码全流程生成</div>
            <div className="quick-actions" style={{ marginTop: 16 }}>
              {projectTemplates.slice(0, 3).map((t) => (
                <button key={t.id} className="quick-action-btn" onClick={() => setCgIdea(t.idea)}>{t.icon} {t.name}</button>
              ))}
            </div>
          </div>
        )}
        {cgMessages.map((msg, i) => (
          <div key={i} className="msg-row assistant">
            <div className="msg-avatar" style={{ background: "#6BCB77" }}>💻</div>
            <div style={{ maxWidth: "85%" }}>
              <div className="msg-bubble">
                <div className="msg-agent-name" style={{ color: "#6BCB77" }}>{msg.agentName || msg.phase}</div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{msg.content}</div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );

  // ─── View: Settings ───────────────────────────────────
  const renderSettings = () => (
    <div className="settings-container">
      <div className="settings-section">
        <h3><Zap size={16} /> 模型供应商配置</h3>
        {providers.map((p) => (
          <div key={p.id} className="provider-card">
            <div className="provider-card-header">
              <div className="p-name">
                <span style={{ fontSize: 16 }}>{getProviderIcon(p.type)}</span>
                {p.name}
                {p.modelsDiscovered ? <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{p.modelsDiscovered} 模型</span> : null}
              </div>
              <button
                className={`toggle-switch ${p.enabled ? "on" : ""}`}
                onClick={() => {
                  const updated = { ...p, enabled: !p.enabled };
                  const newProviders = providers.map((pp) => pp.id === p.id ? updated : pp);
                  setProviders(newProviders);
                  saveProviders(newProviders);
                  syncProvidersToServer(newProviders);
                }}
              />
            </div>
            {p.enabled && (
              <div className="p-fields">
                {p.type !== "ollama" && (
                  <div className="field-row">
                    <label>API Key</label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={p.apiKey}
                      onChange={(e) => {
                        const updated = { ...p, apiKey: e.target.value };
                        const newProviders = providers.map((pp) => pp.id === p.id ? updated : pp);
                        setProviders(newProviders);
                        saveProviders(newProviders);
                      }}
                      onBlur={() => syncProvidersToServer(providers)}
                    />
                  </div>
                )}
                <div className="field-row">
                  <label>Base URL</label>
                  <input
                    value={p.baseUrl}
                    onChange={(e) => {
                      const updated = { ...p, baseUrl: e.target.value };
                      const newProviders = providers.map((pp) => pp.id === p.id ? updated : pp);
                      setProviders(newProviders);
                      saveProviders(newProviders);
                    }}
                    onBlur={() => syncProvidersToServer(providers)}
                  />
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button onClick={async () => {
                    const resp = await apiFetch("/api/providers/test", { method: "POST", body: JSON.stringify({ providerId: p.id }) });
                    const data = await resp.json() as { ok: boolean; modelCount: number; latencyMs: number; error?: string };
                    alert(data.ok ? `连接成功! ${data.modelCount} 模型, ${data.latencyMs}ms` : `连接失败: ${data.error}`);
                  }}>
                    <ShieldCheck size={14} /> 测试连接
                  </button>
                  <button onClick={async () => {
                    const resp = await apiFetch("/api/providers/discover", { method: "POST", body: JSON.stringify({ providerId: p.id }) });
                    if (resp.ok) {
                      const data = await resp.json() as { models: ModelConfig[]; count: number };
                      setModels((prev) => [...prev.filter((m) => m.providerId !== p.id), ...data.models]);
                      const updated = { ...p, modelsDiscovered: data.count };
                      const newProviders = providers.map((pp) => pp.id === p.id ? updated : pp);
                      setProviders(newProviders);
                      saveProviders(newProviders);
                      alert(`发现 ${data.count} 个模型`);
                    }
                  }}>
                    <RefreshCw size={14} /> 发现模型
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ─── View: Custom Agents ──────────────────────────────
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentRole, setNewAgentRole] = useState<AgentConfig["role"]>("coder");
  const [newAgentPrompt, setNewAgentPrompt] = useState("");
  const [newAgentAvatar, setNewAgentAvatar] = useState("🤖");

  const renderAgents = () => (
    <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Bot size={18} /> Agent 管理</h3>
        <button className="primary" onClick={() => setShowCreateAgent(!showCreateAgent)}>
          <Plus size={14} /> 创建 Agent
        </button>
      </div>
      {showCreateAgent && (
        <div className="provider-card" style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 10 }}>创建自定义 Agent</h4>
          <div className="p-fields">
            <div className="field-row">
              <label>名称</label>
              <input value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="Agent 名称" />
            </div>
            <div className="field-row">
              <label>Emoji</label>
              <input value={newAgentAvatar} onChange={(e) => setNewAgentAvatar(e.target.value)} style={{ width: 50, textAlign: "center" }} />
            </div>
            <div className="field-row">
              <label>角色</label>
              <select value={newAgentRole} onChange={(e) => setNewAgentRole(e.target.value as AgentConfig["role"])} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                <option value="coder">编码</option>
                <option value="researcher">研究</option>
                <option value="product">产品</option>
                <option value="testing">测试</option>
                <option value="documentation">文档</option>
              </select>
            </div>
            <div className="field-row">
              <label>System Prompt</label>
              <textarea value={newAgentPrompt} onChange={(e) => setNewAgentPrompt(e.target.value)} placeholder="定义 Agent 的行为..." style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", minHeight: 60, fontFamily: "var(--font)", fontSize: 13 }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="primary" onClick={async () => {
                if (!newAgentName.trim()) return;
                const resp = await apiFetch("/api/agents", {
                  method: "POST",
                  body: JSON.stringify({ name: newAgentName, role: newAgentRole, avatar: newAgentAvatar, systemPrompt: newAgentPrompt, goal: newAgentPrompt.slice(0, 50) }),
                });
                if (resp.ok) {
                  const newAgent = await resp.json() as AgentConfig;
                  setAgents((prev) => [...prev, newAgent]);
                  setShowCreateAgent(false);
                  setNewAgentName(""); setNewAgentPrompt(""); setNewAgentAvatar("🤖");
                }
              }}>创建</button>
              <button onClick={() => setShowCreateAgent(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
      {agents.map((a) => (
        <div key={a.id} className="agent-card" style={{ marginBottom: 6 }}>
          <div className="a-avatar" style={{ background: a.color }}>{a.avatar}</div>
          <div className="a-info">
            <div className="a-name">{a.name} {a.custom && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(自定义)</span>}</div>
            <div className="a-role">{a.role}</div>
            <div className="a-goal">{a.goal || a.systemPrompt?.slice(0, 60)}</div>
          </div>
          {a.custom && (
            <button className="icon-btn" onClick={async () => {
              await apiFetch(`/api/agents/${a.id}`, { method: "DELETE" });
              setAgents((prev) => prev.filter((aa) => aa.id !== a.id));
            }}><Trash2 size={14} /></button>
          )}
        </div>
      ))}
    </div>
  );

  // ─── Right Panel ──────────────────────────────────────
  const renderRightPanel = () => (
    <div className="right-panel">
      <div className="right-panel-tabs">
        <button className={rightTab === "agents" ? "active" : ""} onClick={() => setRightTab("agents")}>
          <Users size={12} /> Agents
        </button>
        <button className={rightTab === "models" ? "active" : ""} onClick={() => setRightTab("models")}>
          <Zap size={12} /> 模型
        </button>
        <button className={rightTab === "info" ? "active" : ""} onClick={() => setRightTab("info")}>
          <Activity size={12} /> 信息
        </button>
      </div>
      <div className="right-panel-content">
        {rightTab === "agents" && agents.map((a) => (
          <div key={a.id} className="agent-card">
            <div className="a-avatar" style={{ background: a.color }}>{a.avatar}</div>
            <div className="a-info">
              <div className="a-name">{a.name}</div>
              <div className="a-goal">{a.goal?.slice(0, 40)}</div>
            </div>
          </div>
        ))}
        {rightTab === "models" && (
          <>
            {providers.filter((p) => p.enabled).map((p) => (
              <div key={p.id} className="provider-group">
                <div className="provider-group-title">{getProviderIcon(p.type)} {p.name}</div>
                {models.filter((m) => m.providerId === p.id).slice(0, 8).map((m) => (
                  <div key={m.id} className="model-card">
                    <div className="m-name">{m.id}</div>
                    <div className="m-caps">
                      {m.capabilities.reasoning && "推理 "}{m.capabilities.fast && "快速 "}{m.capabilities.vision && "视觉 "}{m.capabilities.local && "本地"}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
        {rightTab === "info" && (
          <div>
            <h4 style={{ fontSize: 13, marginBottom: 8 }}>平台信息</h4>
            <dl style={{ fontSize: 13 }}>
              <dt style={{ color: "var(--text-muted)" }}>版本</dt><dd>{appMetadata.version}</dd>
              <dt style={{ color: "var(--text-muted)" }}>模块</dt><dd>{appMetadata.modules.length}</dd>
              <dt style={{ color: "var(--text-muted)" }}>供应商</dt><dd>{providers.length}</dd>
              <dt style={{ color: "var(--text-muted)" }}>已启用</dt><dd>{providers.filter((p) => p.enabled).length}</dd>
              <dt style={{ color: "var(--text-muted)" }}>Agents</dt><dd>{agents.length}</dd>
              <dt style={{ color: "var(--text-muted)" }}>对话</dt><dd>{conversations.length}</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );

  // ─── Main Render ──────────────────────────────────────
  return (
    <ErrorBoundary>
      <div className="app-shell">
        <div className="topbar">
          <div className="topbar-left">
            <button className="icon-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
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
              <span className="status-pill info">
                {providers.filter((p) => p.enabled).length} 供应商
              </span>
              <span className="status-pill info">
                {agents.length} Agents
              </span>
            </div>
            <button className="icon-btn" onClick={() => setRightPanelOpen(!rightPanelOpen)}>
              <PanelLeftOpen size={18} style={{ transform: "scaleX(-1)" }} />
            </button>
          </div>
        </div>

        <div className={`main-layout ${!sidebarOpen ? "sidebar-collapsed" : ""} ${!rightPanelOpen ? "right-collapsed" : ""} ${!sidebarOpen && !rightPanelOpen ? "both-collapsed" : ""}`}>
          {sidebarOpen && (
            <div className="sidebar">
              <div className="sidebar-nav">
                <button className={`nav-item ${view === "chat" ? "active" : ""}`} onClick={() => setView("chat")}>
                  <MessageSquare size={16} /> 对话
                </button>
                <button className={`nav-item ${view === "roundtable" ? "active" : ""}`} onClick={() => setView("roundtable")}>
                  <Users size={16} /> 圆桌会议
                </button>
                <button className={`nav-item ${view === "codegen" ? "active" : ""}`} onClick={() => setView("codegen")}>
                  <Code2 size={16} /> 代码生成
                </button>
                <button className={`nav-item ${view === "projects" ? "active" : ""}`} onClick={() => setView("projects")}>
                  <FolderOpen size={16} /> 项目模板
                </button>
                <button className={`nav-item ${view === "agents" ? "active" : ""}`} onClick={() => setView("agents")}>
                  <Bot size={16} /> Agent 管理
                </button>
                <button className={`nav-item ${view === "settings" ? "active" : ""}`} onClick={() => setView("settings")}>
                  <Settings size={16} /> 设置
                </button>
              </div>

              <div className="sidebar-section">对话历史</div>
              <button className="nav-item" onClick={() => createConversation()} style={{ margin: "0 8px 4px" }}>
                <MessageSquarePlus size={14} /> 新对话
              </button>
              <div className="conversation-list">
                {conversations.map((c) => (
                  <div key={c.id} className={`conv-item ${activeConvId === c.id ? "active" : ""}`} onClick={() => { setActiveConvId(c.id); setView("chat"); }}>
                    <span className="conv-title">{c.title}</span>
                    <span className="conv-type">{c.type === "roundtable" ? "圆桌" : c.type === "group-chat" ? "群聊" : "对话"}</span>
                    <button className="delete-btn" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="main-content">
            {view === "chat" && renderChat()}
            {view === "roundtable" && renderRoundtable()}
            {view === "projects" && renderProjects()}
            {view === "codegen" && renderCodeGen()}
            {view === "settings" && renderSettings()}
            {view === "agents" && renderAgents()}
          </div>

          {rightPanelOpen && renderRightPanel()}
        </div>
      </div>
    </ErrorBoundary>
  );
}

function getProviderIcon(type: string): string {
  const icons: Record<string, string> = {
    openai: "🟢", anthropic: "🟠", gemini: "🔵", deepseek: "🟣",
    qwen: "🟡", moonshot: "🌙", ollama: "🦙", "openai-compatible": "⚪",
  };
  return icons[type] ?? "⚪";
}
