import { useEffect, useRef, useState, useCallback, type ReactNode, Component } from "react";
import {
  Activity, Bot, ChevronDown, ChevronRight, FolderOpen,
  Loader2, MessageSquare, MessageSquarePlus, PanelLeftClose,
  PanelLeftOpen, Play, Plus, RefreshCw, Send, Settings,
  ShieldCheck, Trash2, Users, X, Zap, Vote, FileText,
  Brain, Code2, Microscope, BookOpen, Square, Volume2, VolumeX, Search,
} from "lucide-react";
import { createDefaultProviders, getFallbackModels } from "./core/modelGateway";
import { loadProviders, saveProviders, loadConversations, saveConversation, deleteConversation as deleteConv } from "./core/persistence";
import { DEFAULT_AGENTS, createUserAgent } from "./core/agentConfig";
import type { AgentConfig, AgentTTSConfig, ChatMessage, Conversation, ModelConfig, ProviderConfig, StructuredReport } from "./core/types";
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
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [agentModelConfigs, setAgentModelConfigs] = useState<Array<{ agentId: string; providerId: string; modelId: string; useGlobal?: boolean }>>([]);
  const [agentTTSConfigs, setAgentTTSConfigs] = useState<AgentTTSConfig[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsVoice, setTtsVoice] = useState("mimo_default");
  const [ttsStylePrompt, setTtsStylePrompt] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastSpokenMsgRef = useRef<string>("");

  // Roundtable state
  const [rtTopic, setRtTopic] = useState("");
  const [rtAgents, setRtAgents] = useState<string[]>(["agent-moderator", "agent-product", "agent-architecture", "agent-critic"]);
  const [rtRounds, setRtRounds] = useState(3);
  const [rtStreaming, setRtStreaming] = useState(false);
  const [rtMessages, setRtMessages] = useState<Array<{ agentId: string; agentName: string; agentColor: string; agentAvatar: string; content: string; round: number }>>([]);
  const [rtReport, setRtReport] = useState<StructuredReport | null>(null);

  // Code generation state
  const [cgIdea, setCgIdea] = useState("");
  const [cgStack, setCgStack] = useState("Vite + React + TypeScript");
  const [cgStreaming, setCgStreaming] = useState(false);
  const [cgMessages, setCgMessages] = useState<Array<{ phase: string; content: string; agentName: string }>>([]);
  const [cgPhase, setCgPhase] = useState("");

  // Agent management state
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentRole, setNewAgentRole] = useState<AgentConfig["role"]>("coder");
  const [newAgentPrompt, setNewAgentPrompt] = useState("");
  const [newAgentAvatar, setNewAgentAvatar] = useState("🤖");

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const activeConversation = conversations.find((c) => c.id === activeConvId) ?? null;

  // Server health check
  useEffect(() => {
    const check = async () => {
      try {
        const resp = await apiFetch("/api/health");
        if (resp.ok) {
          setServerConnected(true);
          // Load agents from server
          try {
            const agentResp = await apiFetch("/api/agents");
            if (agentResp.ok) {
              const serverAgents = await agentResp.json() as AgentConfig[];
              if (serverAgents.length > 0) setAgents(serverAgents);
            }
          } catch {}
          // Load conversations from server and merge with local
          try {
            const convResp = await apiFetch("/api/conversations");
            if (convResp.ok) {
              const serverConvs = await convResp.json() as Conversation[];
              if (serverConvs.length > 0) {
                setConversations((prev) => {
                  const serverIds = new Set(serverConvs.map((c) => c.id));
                  const localOnly = prev.filter((c) => !serverIds.has(c.id));
                  const merged = [...serverConvs, ...localOnly];
                  merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                  for (const c of merged) saveConversation(c);
                  return merged;
                });
              }
            }
          } catch {}
          // Load providers from server
          try {
            const provResp = await apiFetch("/api/providers");
            if (provResp.ok) {
              const serverProvs = await provResp.json() as ProviderConfig[];
              if (serverProvs.length > 0) {
                setProviders(serverProvs);
                saveProviders(serverProvs);
              }
            }
          } catch {}
          // Load agent model configs
          try {
            const amResp = await apiFetch("/api/agent-models");
            if (amResp.ok) {
              const amData = await amResp.json() as typeof agentModelConfigs;
              if (amData.length > 0) setAgentModelConfigs(amData);
            }
          } catch {}

          // Discover models for enabled providers
          try {
            const provResp2 = await apiFetch("/api/providers");
            const currentProviders = provResp2.ok ? await provResp2.json() as ProviderConfig[] : [];
            for (const p of currentProviders.filter((pp: ProviderConfig) => pp.enabled && (pp.apiKey || pp.type === "ollama"))) {
              try {
                const modelResp = await apiFetch("/api/providers/discover", { method: "POST", body: JSON.stringify({ providerId: p.id }) });
                if (modelResp.ok) {
                  const data = await modelResp.json() as { models: ModelConfig[] };
                  setModels((prev) => {
                    const existing = prev.filter((m) => m.providerId !== p.id);
                    return [...existing, ...data.models];
                  });
                }
              } catch {}
            }
          } catch {}
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
    setActiveConvId(conv.id);
    setConversations((prev) => {
      const next = [conv, ...prev];
      saveConversation(conv);
      syncConversationsToServer(next);
      return next;
    });
    return conv;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setActiveConvId((prev) => prev === id ? null : prev);
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      deleteConv(id);
      syncConversationsToServer(next);
      return next;
    });
  }, []);

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
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === updatedConv.id);
      const next = idx >= 0 ? prev.map((c) => c.id === updatedConv.id ? updatedConv : c) : [updatedConv, ...prev];
      saveConversation(updatedConv);
      syncConversationsToServer(next);
      return next;
    });

    setChatInput("");
    setStreaming(true);
    setStreamingContent("");
    setStreamingAgent(null);

    try {
      const resp = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          conversationId: conv.id,
          message,
          agentId: selectedAgentId,
          providerId: getEffectiveConfig(selectedAgentId).providerId,
          model: getEffectiveConfig(selectedAgentId).modelId,
        }),
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
        agentAvatar: agent?.avatar,
        createdAt: new Date().toISOString(),
      };
      const finalMessages = [...updatedMessages, assistantMsg];
      const finalConv = { ...updatedConv, messages: finalMessages, updatedAt: new Date().toISOString() };
      setConversations((prev) => {
        const next = prev.map((c) => c.id === finalConv.id ? finalConv : c);
        saveConversation(finalConv);
        syncConversationsToServer(next);
        return next;
      });
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: uid(), role: "system", content: `错误: ${err instanceof Error ? err.message : String(err)}`,
        createdAt: new Date().toISOString(),
      };
      const finalMessages = [...updatedMessages, errorMsg];
      const finalConv = { ...updatedConv, messages: finalMessages, updatedAt: new Date().toISOString() };
      setConversations((prev) => {
        const next = prev.map((c) => c.id === finalConv.id ? finalConv : c);
        saveConversation(finalConv);
        return next;
      });
    } finally {
      setStreaming(false);
      setStreamingContent("");
      setStreamingAgent(null);
    }
  }, [activeConversation, conversations, streaming, selectedAgentId, selectedProviderId, selectedModelId, agents, agentModelConfigs, providers, models, createConversation, showToast]);

  // ─── TTS ─────────────────────────────────────────────
  const speakText = useCallback(async (text: string, agentId?: string) => {
    // Check if TTS is enabled globally or per-agent
    const agentTTS = agentId ? agentTTSConfigs.find((c) => c.agentId === agentId) : undefined;
    if (!ttsEnabled && !agentTTS?.enabled) return;

    // Use per-agent settings if available, otherwise global
    const voice = agentTTS?.voice ?? ttsVoice;
    const stylePrompt = agentTTS?.stylePrompt ?? ttsStylePrompt;
    const speed = agentTTS?.speed;

    setTtsPlaying(true);
    try {
      const resp = await apiFetch("/api/tts", {
        method: "POST",
        body: JSON.stringify({
          text: text.slice(0, 2000),
          voice,
          stylePrompt: stylePrompt || undefined,
          speed,
          format: "wav",
          agentId,
        }),
      });
      if (resp.ok) {
        const data = await resp.json() as { audioBase64: string; format: string };
        const audioBytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([audioBytes], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
        await audio.play();
      } else {
        setTtsPlaying(false);
        const err = await resp.json() as { error: string };
        showToast(`TTS 失败: ${err.error}`, "error");
      }
    } catch (err) {
      setTtsPlaying(false);
      showToast(`TTS 错误: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }, [ttsEnabled, ttsVoice, ttsStylePrompt, agentTTSConfigs, showToast]);

  // ─── Auto-speak: read aloud new assistant messages ───
  useEffect(() => {
    if (!activeConversation || activeConversation.messages.length === 0) return;
    const lastMsg = activeConversation.messages[activeConversation.messages.length - 1];
    if (lastMsg.role !== "assistant" || lastMsg.id === lastSpokenMsgRef.current) return;

    const agentTTS = lastMsg.agentId ? agentTTSConfigs.find((c) => c.agentId === lastMsg.agentId) : null;
    const shouldSpeak = ttsEnabled || agentTTS?.enabled;
    const shouldAutoSpeak = agentTTS?.autoSpeak ?? ttsEnabled;

    if (shouldSpeak && shouldAutoSpeak && lastMsg.content && lastMsg.content !== "(无响应)") {
      lastSpokenMsgRef.current = lastMsg.id;
      speakText(lastMsg.content, lastMsg.agentId);
    }
  }, [activeConversation?.messages, ttsEnabled, agentTTSConfigs, speakText]);

  // ─── View: Chat ───────────────────────────────────────
  // Get effective provider+model for an agent (per-agent config or global)
  const getEffectiveConfig = useCallback((agentId: string) => {
    const agentConfig = agentModelConfigs.find((c) => c.agentId === agentId && !c.useGlobal);
    if (agentConfig) {
      const provider = providers.find((p) => p.id === agentConfig.providerId);
      return { providerId: agentConfig.providerId, modelId: agentConfig.modelId, provider };
    }
    // Fall back to global selection
    if (selectedProviderId && selectedModelId) {
      return { providerId: selectedProviderId, modelId: selectedModelId, provider: providers.find((p) => p.id === selectedProviderId) };
    }
    // Fall back to first enabled provider with key
    const fallback = providers.find((p) => p.enabled && (p.apiKey || p.type === "ollama"));
    if (fallback) {
      const fallbackModels = models.filter((m) => m.providerId === fallback.id);
      return { providerId: fallback.id, modelId: fallbackModels[0]?.id ?? fallback.defaultModel ?? "", provider: fallback };
    }
    return { providerId: "", modelId: "", provider: undefined };
  }, [agentModelConfigs, selectedProviderId, selectedModelId, providers, models]);

  // Get available models for the currently selected provider
  const availableModels = selectedProviderId
    ? models.filter((m) => m.providerId === selectedProviderId)
    : models.filter((m) => providers.some((p) => p.id === m.providerId && p.enabled));

  // Auto-select first provider+model if none selected
  useEffect(() => {
    if (!selectedProviderId && providers.length > 0) {
      const enabled = providers.find((p) => p.enabled && (p.apiKey || p.type === "ollama"));
      if (enabled) {
        setSelectedProviderId(enabled.id);
        const provModels = models.filter((m) => m.providerId === enabled.id);
        if (provModels.length > 0 && !selectedModelId) {
          setSelectedModelId(provModels[0].id);
        }
      }
    }
  }, [providers, models, selectedProviderId, selectedModelId]);

  const hasConfiguredProvider = providers.some((p) => p.enabled && (p.apiKey || p.type === "ollama"));
  const renderChat = () => (
    <div className="chat-container">
      <div className="chat-messages">
        {(!activeConversation || activeConversation.messages.length === 0) && (
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <div className="empty-text">开始对话</div>
            {!hasConfiguredProvider ? (
              <div className="notice" style={{ marginTop: 12, cursor: "pointer" }} onClick={() => setView("settings")}>
                ⚠️ 尚未配置 AI 供应商，点击此处前往设置
              </div>
            ) : (
              <>
                <div className="empty-hint">选择一个 Agent，输入消息开始交流</div>
                <div className="quick-actions" style={{ marginTop: 16 }}>
                  {["帮我写一个 TODO 应用", "解释一下 React Hooks", "如何优化 Web 性能？"].map((q) => (
                    <button key={q} className="quick-action-btn" onClick={() => sendChatMessage(q)}>{q}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {activeConversation?.messages.map((msg) => (
          <div key={msg.id} className={`msg-row ${msg.role}`}>
            <div className="msg-avatar" style={{ background: msg.role === "user" ? "#4D96FF" : (msg.agentColor ?? "#4ECDC4") }}>
              {msg.role === "user" ? "👤" : (msg.agentAvatar ?? "🤖")}
            </div>
            <div>
              <div className="msg-bubble">
                {msg.agentName && (
                  <div className="msg-agent-name" style={{ color: msg.agentColor }}>
                    {msg.agentAvatar} {msg.agentName}
                    {(() => {
                      const agentCfg = agentModelConfigs.find((c) => c.agentId === msg.agentId && !c.useGlobal);
                      const providerId = agentCfg?.providerId ?? selectedProviderId;
                      const modelId = agentCfg?.modelId ?? selectedModelId;
                      const provider = providers.find((p) => p.id === providerId);
                      if (!modelId) return null;
                      return <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6, fontWeight: 400 }}>{getProviderIcon(provider?.type ?? "")} {modelId}</span>;
                    })()}
                  </div>
                )}
                <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                {msg.role === "assistant" && (ttsEnabled || agentTTSConfigs.find((c) => c.agentId === msg.agentId)?.enabled) && (
                  <button className="icon-btn" style={{ marginTop: 4, fontSize: 12, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }} onClick={() => speakText(msg.content, msg.agentId)} disabled={ttsPlaying} title="朗读此消息">
                    {ttsPlaying ? "⏳" : <Volume2 size={12} />}
                  </button>
                )}
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <div className="agent-selector" style={{ flex: 1, margin: 0 }}>
            {agents.map((a) => (
              <button key={a.id} className={`agent-chip ${selectedAgentId === a.id ? "selected" : ""}`} onClick={() => setSelectedAgentId(a.id)}>
                <span>{a.avatar}</span> {a.name}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {getProviderIcon(providers.find((p) => p.id === (agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal)?.providerId ?? selectedProviderId))?.type ?? "")}
              </span>
              <select
                value={agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal)?.providerId ?? selectedProviderId}
                onChange={(e) => {
                  const v = e.target.value;
                  const existingCfg = agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal);
                  if (existingCfg) {
                    const provModels = models.filter((m) => m.providerId === v);
                    const newConfigs = agentModelConfigs.map((c) =>
                      c.agentId === selectedAgentId ? { ...c, providerId: v, modelId: provModels[0]?.id ?? "" } : c
                    );
                    setAgentModelConfigs(newConfigs);
                    apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: newConfigs }) });
                  } else {
                    setSelectedProviderId(v);
                    const provModels = models.filter((m) => m.providerId === v);
                    setSelectedModelId(provModels[0]?.id ?? "");
                  }
                }}
                style={{ padding: "2px 4px", border: "none", fontSize: 12, background: "transparent", maxWidth: 100, cursor: "pointer" }}
              >
                <option value="">全局</option>
                {providers.filter((p) => p.enabled).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <span style={{ fontSize: 10, color: "var(--border)" }}>|</span>
              <select
                value={agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal)?.modelId ?? selectedModelId}
                onChange={(e) => {
                  const v = e.target.value;
                  const existingCfg = agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal);
                  if (existingCfg) {
                    const newConfigs = agentModelConfigs.map((c) =>
                      c.agentId === selectedAgentId ? { ...c, modelId: v } : c
                    );
                    setAgentModelConfigs(newConfigs);
                    apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: newConfigs }) });
                  } else {
                    setSelectedModelId(v);
                  }
                }}
                style={{ padding: "2px 4px", border: "none", fontSize: 12, background: "transparent", maxWidth: 150, cursor: "pointer" }}
              >
                {(() => {
                  const cfgProviderId = agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal)?.providerId ?? selectedProviderId;
                  const cfgModels = models.filter((m) => m.providerId === cfgProviderId);
                  if (cfgModels.length === 0) return <option value="">无模型</option>;
                  return cfgModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.id}</option>
                  ));
                })()}
              </select>
            </div>
            {(() => {
              const cfgProviderId = agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal)?.providerId ?? selectedProviderId;
              const cfgProvider = providers.find((p) => p.id === cfgProviderId);
              if (cfgProvider?.type !== "xiaomi-mimo") return null;
              return (
                <button
                  className="icon-btn"
                  onClick={() => {
                    const updated = { ...cfgProvider, webSearchEnabled: !cfgProvider.webSearchEnabled };
                    const newProviders = providers.map((pp) => pp.id === cfgProvider.id ? updated : pp);
                    setProviders(newProviders);
                    saveProviders(newProviders);
                    syncProvidersToServer(newProviders);
                  }}
                  title={cfgProvider.webSearchEnabled ? "关闭联网搜索" : "开启联网搜索"}
                  style={{ color: cfgProvider.webSearchEnabled ? "var(--primary)" : "var(--text-muted)" }}
                >
                  <Search size={14} />
                </button>
              );
            })()}
            <button
              className={`icon-btn ${ttsEnabled ? "tts-active" : ""}`}
              onClick={() => setTtsEnabled(!ttsEnabled)}
              title={ttsEnabled ? "关闭语音朗读" : "开启语音朗读"}
              style={{ color: ttsEnabled ? "var(--primary)" : "var(--text-muted)" }}
            >
              {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── View: Roundtable ─────────────────────────────────

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
                {p.type === "xiaomi-mimo" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input
                        type="password"
                        placeholder="输入 MiMo API Key"
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
                    <div className="field-row">
                      <label>API 地址</label>
                      <select
                        value={p.altBaseUrl || p.baseUrl}
                        onChange={(e) => {
                          const v = e.target.value;
                          let updated: ProviderConfig;
                          if (v === "https://token-plan-cn.xiaomimimo.com/v1") {
                            updated = { ...p, baseUrl: "https://api.xiaomimimo.com/v1", altBaseUrl: v };
                          } else {
                            updated = { ...p, baseUrl: v, altBaseUrl: undefined };
                          }
                          const newProviders = providers.map((pp) => pp.id === p.id ? updated : pp);
                          setProviders(newProviders);
                          saveProviders(newProviders);
                          syncProvidersToServer(newProviders);
                        }}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                      >
                        <option value="https://api.xiaomimimo.com/v1">标准 (api.xiaomimimo.com)</option>
                        <option value="https://token-plan-cn.xiaomimimo.com/v1">Token Plan CN</option>
                      </select>
                    </div>
                    <div className="field-row">
                      <label>联网搜索</label>
                      <button
                        className={`toggle-switch ${p.webSearchEnabled ? "on" : ""}`}
                        onClick={() => {
                          const updated = { ...p, webSearchEnabled: !p.webSearchEnabled };
                          const newProviders = providers.map((pp) => pp.id === p.id ? updated : pp);
                          setProviders(newProviders);
                          saveProviders(newProviders);
                          syncProvidersToServer(newProviders);
                        }}
                      />
                    </div>
                    <div className="field-row">
                      <label>TTS 语音</label>
                      <button
                        className={`toggle-switch ${p.ttsEnabled ? "on" : ""}`}
                        onClick={() => {
                          const updated = { ...p, ttsEnabled: !p.ttsEnabled };
                          const newProviders = providers.map((pp) => pp.id === p.id ? updated : pp);
                          setProviders(newProviders);
                          saveProviders(newProviders);
                          syncProvidersToServer(newProviders);
                          if (updated.ttsEnabled) setTtsEnabled(true);
                        }}
                      />
                    </div>
                    {p.ttsEnabled && (
                      <>
                        <div className="field-row">
                          <label>音色</label>
                          <select
                            value={p.ttsVoice ?? "mimo_default"}
                            onChange={(e) => {
                              const updated = { ...p, ttsVoice: e.target.value };
                              const newProviders = providers.map((pp) => pp.id === p.id ? updated : pp);
                              setProviders(newProviders);
                              saveProviders(newProviders);
                              setTtsVoice(e.target.value);
                            }}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                          >
                            <option value="mimo_default">默认 (冰糖)</option>
                            <option value="冰糖">冰糖 (女)</option>
                            <option value="茉莉">茉莉 (女)</option>
                            <option value="苏打">苏打 (男)</option>
                            <option value="白桦">白桦 (男)</option>
                            <option value="Mia">Mia (EN)</option>
                          </select>
                        </div>
                        <div className="field-row">
                          <label>TTS 模型</label>
                          <select
                            value={p.ttsModel ?? "mimo-v2.5-tts"}
                            onChange={(e) => {
                              const updated = { ...p, ttsModel: e.target.value };
                              const newProviders = providers.map((pp) => pp.id === p.id ? updated : pp);
                              setProviders(newProviders);
                              saveProviders(newProviders);
                            }}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                          >
                            <option value="mimo-v2.5-tts">内置音色 (mimo-v2.5-tts)</option>
                            <option value="mimo-v2.5-tts-voicedesign">音色设计 (voicedesign)</option>
                            <option value="mimo-v2.5-tts-voiceclone">音色克隆 (voiceclone)</option>
                          </select>
                        </div>
                        <div className="field-row">
                          <label>语速</label>
                          <select
                            value={p.ttsSpeed ?? 1.0}
                            onChange={(e) => {
                              const updated = { ...p, ttsSpeed: parseFloat(e.target.value) };
                              const newProviders = providers.map((pp) => pp.id === p.id ? updated : pp);
                              setProviders(newProviders);
                              saveProviders(newProviders);
                            }}
                            style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                          >
                            <option value="0.5">0.5x 慢速</option>
                            <option value="0.75">0.75x</option>
                            <option value="1.0">1.0x 正常</option>
                            <option value="1.25">1.25x</option>
                            <option value="1.5">1.5x 快速</option>
                            <option value="2.0">2.0x 极快</option>
                          </select>
                        </div>
                        <div className="field-row">
                          <label>风格指令</label>
                          <input
                            placeholder="如: 温柔/活泼/磁性/严肃/东北话/粤语/唱歌..."
                            value={p.ttsStylePrompt ?? ttsStylePrompt}
                            onChange={(e) => {
                              setTtsStylePrompt(e.target.value);
                              const updated = { ...p, ttsStylePrompt: e.target.value };
                              const newProviders = providers.map((pp) => pp.id === p.id ? updated : pp);
                              setProviders(newProviders);
                              saveProviders(newProviders);
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.5 }}>
                          支持风格: 情感(温柔/高冷/活泼/严肃/慵懒) | 音色(磁性/醇厚/清亮/空灵/甜美) | 腔调(御姐音/正太音/大叔音/台湾腔) | 方言(东北话/四川话/粤语)
                        </div>
                        <div className="field-row">
                          <label>测试 TTS</label>
                          <button onClick={() => speakText("你好，我是小米 MiMo，很高兴认识你！")}>
                            🔊 试听
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
                {p.type !== "ollama" && p.type !== "xiaomi-mimo" && (
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
                {p.type !== "xiaomi-mimo" && (
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
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button onClick={async () => {
                    const resp = await apiFetch("/api/providers/test", { method: "POST", body: JSON.stringify({ providerId: p.id }) });
                    const data = await resp.json() as { ok: boolean; modelCount: number; latencyMs: number; error?: string };
                    showToast(data.ok ? `连接成功! ${data.modelCount} 模型, ${data.latencyMs}ms` : `连接失败: ${data.error}`, data.ok ? "success" : "error");
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
                      showToast(`发现 ${data.count} 个模型`, "success");
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
      {agents.map((a) => {
        const agentCfg = agentModelConfigs.find((c) => c.agentId === a.id && !c.useGlobal);
        const effectiveProvider = agentCfg ? providers.find((p) => p.id === agentCfg.providerId) : null;
        const effectiveModel = agentCfg?.modelId ?? "全局默认";
        return (
        <div key={a.id} className="agent-card" style={{ marginBottom: 6, flexDirection: "column", alignItems: "stretch" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
          <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 50 }}>模型:</span>
            <select
              value={agentCfg?.providerId ?? ""}
              onChange={(e) => {
                const newProviderId = e.target.value;
                if (!newProviderId) {
                  const newConfigs = agentModelConfigs.filter((c) => c.agentId !== a.id);
                  setAgentModelConfigs(newConfigs);
                  apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: newConfigs }) });
                } else {
                  const provModels = models.filter((m) => m.providerId === newProviderId);
                  const newConfig = { agentId: a.id, providerId: newProviderId, modelId: provModels[0]?.id ?? "" };
                  const newConfigs = [...agentModelConfigs.filter((c) => c.agentId !== a.id), newConfig];
                  setAgentModelConfigs(newConfigs);
                  apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: newConfigs }) });
                }
              }}
              style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 11, background: "var(--bg-card)", maxWidth: 100 }}
            >
              <option value="">全局</option>
              {providers.filter((p) => p.enabled).map((p) => (
                <option key={p.id} value={p.id}>{getProviderIcon(p.type)} {p.name}</option>
              ))}
            </select>
            <select
              value={agentCfg?.modelId ?? ""}
              onChange={(e) => {
                const newConfigs = agentModelConfigs.map((c) =>
                  c.agentId === a.id ? { ...c, modelId: e.target.value } : c
                );
                setAgentModelConfigs(newConfigs);
                apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: newConfigs }) });
              }}
              style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 11, background: "var(--bg-card)", maxWidth: 200 }}
            >
              {!agentCfg && <option value="">{effectiveModel}</option>}
              {agentCfg && models.filter((m) => m.providerId === agentCfg.providerId).map((m) => (
                <option key={m.id} value={m.id}>{m.id} {m.capabilities.reasoning ? "🧠" : ""}{m.capabilities.fast ? "⚡" : ""}{m.capabilities.vision ? "👁" : ""}</option>
              ))}
            </select>
            {agentCfg && (
              <span style={{ fontSize: 10, color: "var(--primary)" }}>✓ 自定义</span>
            )}
          </div>
          {/* Per-Agent TTS Config */}
          {(() => {
            const agentTTS = agentTTSConfigs.find((c) => c.agentId === a.id);
            const mimoProvider = providers.find((p) => p.type === "xiaomi-mimo" && p.enabled && p.apiKey);
            if (!mimoProvider) return null;
            return (
              <div style={{ marginTop: 6, padding: "6px 8px", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Volume2 size={12} style={{ color: "var(--text-muted)" }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>语音设置</span>
                  <button
                    className={`toggle-switch ${agentTTS?.enabled ? "on" : ""}`}
                    onClick={() => {
                      const existing = agentTTSConfigs.find((c) => c.agentId === a.id);
                      const newConfig: AgentTTSConfig = {
                        agentId: a.id,
                        enabled: !existing?.enabled,
                        voice: existing?.voice ?? "mimo_default",
                        speed: existing?.speed,
                        stylePrompt: existing?.stylePrompt,
                        autoSpeak: existing?.autoSpeak,
                      };
                      const newConfigs = [...agentTTSConfigs.filter((c) => c.agentId !== a.id), newConfig];
                      setAgentTTSConfigs(newConfigs);
                      apiFetch("/api/agent-tts-configs", { method: "PUT", body: JSON.stringify({ configs: newConfigs }) });
                      if (newConfig.enabled) setTtsEnabled(true);
                    }}
                    style={{ transform: "scale(0.8)" }}
                  />
                </div>
                {agentTTS?.enabled && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <select
                      value={agentTTS.voice ?? "mimo_default"}
                      onChange={(e) => {
                        const newConfigs = agentTTSConfigs.map((c) =>
                          c.agentId === a.id ? { ...c, voice: e.target.value } : c
                        );
                        setAgentTTSConfigs(newConfigs);
                        apiFetch("/api/agent-tts-configs", { method: "PUT", body: JSON.stringify({ configs: newConfigs }) });
                      }}
                      style={{ padding: "2px 4px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 11, background: "var(--bg-card)" }}
                    >
                      <option value="mimo_default">默认</option>
                      <option value="冰糖">冰糖 ♀</option>
                      <option value="茉莉">茉莉 ♀</option>
                      <option value="苏打">苏打 ♂</option>
                      <option value="白桦">白桦 ♂</option>
                      <option value="Mia">Mia EN</option>
                    </select>
                    <select
                      value={agentTTS.speed ?? 1.0}
                      onChange={(e) => {
                        const newConfigs = agentTTSConfigs.map((c) =>
                          c.agentId === a.id ? { ...c, speed: parseFloat(e.target.value) } : c
                        );
                        setAgentTTSConfigs(newConfigs);
                        apiFetch("/api/agent-tts-configs", { method: "PUT", body: JSON.stringify({ configs: newConfigs }) });
                      }}
                      style={{ padding: "2px 4px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 11, background: "var(--bg-card)" }}
                    >
                      <option value="0.5">0.5x</option>
                      <option value="0.75">0.75x</option>
                      <option value="1.0">1.0x</option>
                      <option value="1.25">1.25x</option>
                      <option value="1.5">1.5x</option>
                      <option value="2.0">2.0x</option>
                    </select>
                    <input
                      placeholder="风格: 温柔/活泼/严肃..."
                      value={agentTTS.stylePrompt ?? ""}
                      onChange={(e) => {
                        const newConfigs = agentTTSConfigs.map((c) =>
                          c.agentId === a.id ? { ...c, stylePrompt: e.target.value } : c
                        );
                        setAgentTTSConfigs(newConfigs);
                      }}
                      onBlur={() => apiFetch("/api/agent-tts-configs", { method: "PUT", body: JSON.stringify({ configs: agentTTSConfigs }) })}
                      style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 11, background: "var(--bg-card)", flex: 1, minWidth: 100 }}
                    />
                    <button
                      className="icon-btn"
                      onClick={() => speakText("你好，很高兴认识你！", a.id)}
                      disabled={ttsPlaying}
                      style={{ fontSize: 11, padding: "2px 6px" }}
                    >
                      {ttsPlaying ? "⏳" : "🔊"}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        );
      })}
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
      {toast && (
        <div style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 1000,
          padding: "10px 16px", borderRadius: 8,
          background: toast.type === "success" ? "rgba(107,203,119,0.95)" : toast.type === "error" ? "rgba(255,107,107,0.95)" : "rgba(77,150,255,0.95)",
          color: "white", fontSize: 13, fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          animation: "fadeIn 0.2s ease-out",
        }}>
          {toast.message}
        </div>
      )}
    </ErrorBoundary>
  );
}

function getProviderIcon(type: string): string {
  const icons: Record<string, string> = {
    openai: "🟢", anthropic: "🟠", gemini: "🔵", deepseek: "🟣",
    qwen: "🟡", moonshot: "🌙", ollama: "🦙", "openai-compatible": "⚪",
    "xiaomi-mimo": "🔵",
  };
  return icons[type] ?? "⚪";
}
