import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, StopCircle, Plus, ChevronLeft, Image as ImageIcon,
  Paperclip, X, Copy, RefreshCw, Trash2, GitBranch, Volume2,
  MoreVertical, Search, ChevronDown, Pin, PinOff, Settings,
} from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, uid, formatTime } from "../lib/shared";
import { compressImage, formatBytes } from "../lib/imageCompress";
import { MessageRenderer } from "../components/MessageRenderer";
import type { ChatMessage } from "../core/types";

// ─── Conversation List Panel ────────────────────────────────────

function ConversationList({
  onSelect, onNew,
}: {
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const { conversations, setConversations } = useStore();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const chatConvs = conversations
    .filter((c) => c.type === "chat")
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const filtered = search
    ? chatConvs.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase()))
      )
    : chatConvs;

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
  };

  const handlePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      {/* Header */}
      <div style={{
        padding: "12px 16px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>对话</h2>
        <button onClick={onNew} style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "8px 12px", borderRadius: 8, border: "none",
          background: "var(--primary)", color: "#fff", fontSize: 13,
          fontWeight: 600, cursor: "pointer",
        }}>
          <Plus size={14} /> 新对话
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "8px 16px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", borderRadius: 10,
          background: "var(--bg-secondary)", border: "1px solid var(--border)",
        }}>
          <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索对话..."
            style={{
              flex: 1, border: "none", background: "transparent",
              outline: "none", fontSize: 13, color: "var(--text-primary)",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{
              border: "none", background: "transparent", cursor: "pointer",
              color: "var(--text-muted)", padding: 0, display: "flex",
            }}><X size={14} /></button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: "auto", padding: "0 8px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}>
            {search ? "没有找到匹配的对话" : "暂无对话，点击右上角创建"}
          </div>
        )}
        {filtered.map((c) => {
          const lastMsg = c.messages[c.messages.length - 1];
          const preview = lastMsg
            ? lastMsg.content.slice(0, 50).replace(/\n/g, " ")
            : "空对话";
          return (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              style={{
                padding: "12px 14px", marginBottom: 4, borderRadius: 12,
                background: "var(--bg-card)", cursor: "pointer",
                border: "1px solid var(--border)",
                transition: "background 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {c.pinned && <Pin size={11} style={{ color: "var(--primary)", flexShrink: 0 }} />}
                    <span style={{
                      fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {c.title}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12, color: "var(--text-muted)", marginTop: 2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {preview}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 8 }}>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {new Date(c.updatedAt).toLocaleDateString() === new Date().toLocaleDateString()
                      ? formatTime(c.updatedAt)
                      : new Date(c.updatedAt).toLocaleDateString()}
                  </span>
                  <button onClick={(e) => handlePin(c.id, e)} style={{
                    border: "none", background: "transparent", cursor: "pointer",
                    color: c.pinned ? "var(--primary)" : "var(--text-muted)",
                    padding: 4, display: "flex",
                  }}>
                    {c.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                  </button>
                  <button onClick={(e) => handleDelete(c.id, e)} style={{
                    border: "none", background: "transparent", cursor: "pointer",
                    color: "var(--text-muted)", padding: 4, display: "flex",
                  }}><Trash2 size={12} /></button>
                </div>
              </div>
              {c.branchedFrom && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  fontSize: 10, color: "var(--violet, #8b5cf6)", marginTop: 4,
                  padding: "1px 6px", borderRadius: 4,
                  background: "rgba(139,92,246,0.08)",
                }}>
                  <GitBranch size={10} /> 分支对话
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Chat View ─────────────────────────────────────────────

export function MobileChatView() {
  const store = useStore();
  const {
    conversations, activeConvId, setActiveConvId, setConversations,
    providers, setProviders, models, agents, selectedAgentId, setSelectedAgentId,
    selectedProviderId, setSelectedProviderId, selectedModelId, setSelectedModelId,
    agentModelConfigs, setAgentModelConfigs, agentTTSConfigs,
    ttsEnabled, setTtsPlaying, createConversation, showToast,
    branchConversation, skills, updateTokenUsage, tokenUsageByConv,
  } = store;

  const activeConv = conversations.find((c) => c.id === activeConvId);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [showConvList, setShowConvList] = useState(!activeConvId);
  const [attachedImages, setAttachedImages] = useState<Array<{ dataUrl: string; rawFile: File; info: string }>>([]);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; type: string; size: number; content?: string; base64?: string }>>([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [msgActionId, setMsgActionId] = useState<string | null>(null);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [specifiedSkill, setSpecifiedSkill] = useState("");
  const [showProviderBar, setShowProviderBar] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [activeConv?.messages.length, streamContent, scrollToBottom]);

  // Auto-select provider/model
  useEffect(() => {
    if (!selectedProviderId && providers.length > 0) {
      const enabled = providers.find((p) => p.enabled && (p.apiKey || p.type === "ollama"));
      if (enabled) {
        setSelectedProviderId(enabled.id);
        const provModels = models.filter((m) => m.providerId === enabled.id);
        if (provModels.length > 0 && !selectedModelId) setSelectedModelId(provModels[0].id);
      }
    }
  }, [providers, models, selectedProviderId, selectedModelId, setSelectedProviderId, setSelectedModelId]);

  const effectiveProvider = (() => {
    if (selectedAgentId) {
      const cfg = agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal);
      if (cfg?.providerId) return providers.find((p) => p.id === cfg.providerId);
    }
    return providers.find((p) => p.id === selectedProviderId);
  })();

  const effectiveModel = (() => {
    if (selectedAgentId) {
      const cfg = agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal);
      if (cfg?.modelId) return models.find((m) => m.id === cfg.modelId);
    }
    return models.find((m) => m.id === selectedModelId);
  })();

  // ─── Image handling ─────────────────────────────────────────

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const result = await compressImage(file, { maxDimension: 1024, maxBytes: 4 * 1024 * 1024 });
        setAttachedImages((prev) => [...prev, {
          dataUrl: result.dataUrl,
          rawFile: file,
          info: `${file.name} ${result.width}x${result.height} ${formatBytes(result.compressedSize)}`,
        }]);
      } catch {
        showToast("图片压缩失败", "error");
      }
    }
    e.target.value = "";
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) continue;
      const reader = new FileReader();
      reader.onload = () => {
        const content = typeof reader.result === "string" ? reader.result : "";
        setAttachedFiles((prev) => [...prev, {
          name: file.name, type: file.type, size: file.size,
          content: content.slice(0, 50000),
        }]);
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  // Clipboard paste
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          try {
            const result = await compressImage(file, { maxDimension: 1024, maxBytes: 4 * 1024 * 1024 });
            setAttachedImages((prev) => [...prev, {
              dataUrl: result.dataUrl,
              rawFile: file,
              info: `粘贴图片 ${result.width}x${result.height} ${formatBytes(result.compressedSize)}`,
            }]);
          } catch {
            showToast("图片处理失败", "error");
          }
        }
        return;
      }
    }
  };

  // ─── Send message ────────────────────────────────────────────

  const sendMessage = async () => {
    if ((!input.trim() && attachedImages.length === 0 && attachedFiles.length === 0) || streaming) return;

    let convId = activeConvId;
    if (!convId) {
      const conv = createConversation("chat", input.trim().slice(0, 20) || "图片对话");
      convId = conv.id;
      setActiveConvId(conv.id);
      setShowConvList(false);
    }

    const msg = input.trim();
    setInput("");

    // Build user message
    const userMsg: ChatMessage = {
      id: uid(), role: "user", content: msg,
      createdAt: new Date().toISOString(),
      imageData: attachedImages[0]?.dataUrl,
      additionalImages: attachedImages.length > 1 ? attachedImages.slice(1).map((i) => i.dataUrl) : undefined,
      attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
    };

    // Add user message locally
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: [...c.messages, userMsg], updatedAt: new Date().toISOString() }
          : c
      )
    );

    setStreaming(true);
    setStreamContent("");
    setAttachedImages([]);
    setAttachedFiles([]);

    try {
      const provider = effectiveProvider;
      if (!provider) { showToast("请先配置 API 密钥", "error"); setStreaming(false); return; }

      const controller = new AbortController();
      abortRef.current = controller;

      const body: Record<string, unknown> = {
        conversationId: convId, message: msg,
        agentId: selectedAgentId || undefined,
        providerId: provider.id,
        model: effectiveModel?.id,
      };
      if (userMsg.imageData) body.imageData = userMsg.imageData;
      if (userMsg.additionalImages) body.additionalImages = userMsg.additionalImages;
      if (userMsg.attachedFiles) body.attachedFiles = userMsg.attachedFiles;
      if (specifiedSkill) body.specifiedSkill = specifiedSkill;

      const resp = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      // Parse SSE response - handle both streaming and buffered responses
      let full = "";
      let eventType = "";

      const processSSEText = (text: string) => {
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("event: ")) { eventType = line.slice(7).trim(); continue; }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "text" && data.content) {
                full += data.content;
                setStreamContent(full);
              } else if (eventType === "usage") {
                const u = data.usage ?? data;
                if (u.prompt || u.completion) {
                  updateTokenUsage(convId!, {
                    prompt: u.prompt ?? 0,
                    completion: u.completion ?? 0,
                    cached: u.cachedTokens ?? 0,
                    compressionSaved: u.compressionSaved ?? 0,
                  });
                }
              } else if (eventType === "done") {
                // Extract reasoning from <think> tags for separate storage
                const thinkMatches = full.match(/<think>([\s\S]*?)<\/think>/g);
                const reasoning = thinkMatches ? thinkMatches.map(m => m.replace(/<think>|<\/think>/g, "")).join("") : "";
                const cleanContent = full.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
                const assistantMsg: ChatMessage = {
                  id: data.messageId ?? uid(),
                  role: "assistant",
                  content: cleanContent,
                  reasoningContent: reasoning || undefined,
                  createdAt: new Date().toISOString(),
                  agentId: data.agentId,
                  tokenUsage: data.tokenUsage,
                };
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: new Date().toISOString() }
                      : c
                  )
                );
                setStreamContent("");
              } else if (eventType === "error") {
                showToast(`错误: ${data.error}`, "error");
              }
            } catch {}
          }
        }
      };

      // Read the response stream
      const reader = resp.body?.getReader();
      if (reader) {
        // Streaming mode - read chunks as they arrive
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          processSSEText(parts.join("\n"));
        }
        // Process any remaining buffer
        if (buffer.trim()) processSSEText(buffer);
      } else {
        // Fallback: read entire response as text
        const text = await resp.text();
        processSSEText(text);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        showToast("已停止生成", "info");
      } else {
        showToast(`请求失败: ${err instanceof Error ? err.message : "未知错误"}`, "error");
      }
    }
    setStreaming(false);
    abortRef.current = null;
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setStreaming(false);
    if (streamContent) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId
            ? {
                ...c,
                messages: [...c.messages, {
                  id: uid(), role: "assistant" as const, content: streamContent + "\n\n[已停止]",
                  createdAt: new Date().toISOString(),
                }],
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );
      setStreamContent("");
    }
  };

  // ─── TTS ────────────────────────────────────────────────────

  const speakText = async (text: string, agentId?: string) => {
    const agentTTS = agentId ? agentTTSConfigs.find((c) => c.agentId === agentId) : undefined;
    setTtsPlaying(true);
    try {
      const resp = await apiFetch("/api/tts", {
        method: "POST",
        body: JSON.stringify({
          text: text.slice(0, 2000),
          voice: agentTTS?.voice, stylePrompt: agentTTS?.stylePrompt,
          speed: agentTTS?.speed, format: "wav", agentId,
          ttsProviderId: agentTTS?.ttsProviderId,
        }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { audioBase64: string; format: string };
        const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
        const audio = new Audio(url);
        audio.onended = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
        await audio.play();
      } else {
        setTtsPlaying(false);
        showToast("TTS 失败", "error");
      }
    } catch {
      setTtsPlaying(false);
    }
  };

  // ─── Message actions ────────────────────────────────────────

  const handleCopyMsg = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast("已复制", "success");
    } catch {
      showToast("复制失败", "error");
    }
    setMsgActionId(null);
  };

  const handleRegenerate = (msg: ChatMessage) => {
    // Find the user message before this assistant message
    if (!activeConv) return;
    const idx = activeConv.messages.findIndex((m) => m.id === msg.id);
    const userMsg = activeConv.messages.slice(0, idx).reverse().find((m) => m.role === "user");
    if (!userMsg) return;
    // Remove this assistant message and re-send
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, messages: c.messages.filter((m) => m.id !== msg.id) }
          : c
      )
    );
    setInput(userMsg.content);
    // Will be sent when user hits send
    setMsgActionId(null);
    showToast("消息已回退，请重新发送", "info");
  };

  const handleDeleteMsg = (msgId: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? { ...c, messages: c.messages.filter((m) => m.id !== msgId) }
          : c
      )
    );
    setMsgActionId(null);
  };

  const handleBranch = (msg: ChatMessage) => {
    if (!activeConvId) return;
    branchConversation(activeConvId, msg.id);
    setShowConvList(true);
    setMsgActionId(null);
    showToast("已创建分支对话", "success");
  };

  // ─── Conversation list view ─────────────────────────────────

  if (showConvList || !activeConvId) {
    return (
      <ConversationList
        onSelect={(id) => { setActiveConvId(id); setShowConvList(false); }}
        onNew={() => {
          const conv = createConversation("chat", "新对话");
          setActiveConvId(conv.id);
          setShowConvList(false);
        }}
      />
    );
  }

  // ─── Chat view ──────────────────────────────────────────────

  const convTokenUsage = activeConvId ? (tokenUsageByConv[activeConvId] ?? { promptTokens: 0, completionTokens: 0, cachedTokens: 0, compressionSaved: 0 }) : null;
  const installedSkills = skills.filter((s) => s.installed);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      {/* Header */}
      <div style={{
        padding: "8px 12px", borderBottom: "1px solid var(--border)",
        background: "var(--bg-card)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <button onClick={() => { setShowConvList(true); }} style={{
              border: "none", background: "transparent", cursor: "pointer",
              color: "var(--text-primary)", padding: 4, display: "flex",
            }}><ChevronLeft size={20} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 600, color: "var(--text-primary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {activeConv?.title || "对话"}
              </div>
              {convTokenUsage && (convTokenUsage.promptTokens > 0 || convTokenUsage.completionTokens > 0) && (
                <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                  入 {convTokenUsage.promptTokens.toLocaleString()} · 出 {convTokenUsage.completionTokens.toLocaleString()}
                  {convTokenUsage.cachedTokens > 0 && <span> · 缓存 {convTokenUsage.cachedTokens.toLocaleString()}</span>}
                  {convTokenUsage.compressionSaved > 0 && <span> · 节省 {convTokenUsage.compressionSaved.toLocaleString()}</span>}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {/* Provider/Model selector toggle */}
            <button onClick={() => setShowProviderBar(!showProviderBar)} style={{
              border: "none", background: showProviderBar ? "var(--primary-dim)" : "transparent",
              cursor: "pointer", color: "var(--text-muted)", padding: 6,
              borderRadius: 8, display: "flex",
            }}><Settings size={16} /></button>
          </div>
        </div>

        {/* Provider/Model bar */}
        {showProviderBar && (
          <div style={{
            display: "flex", gap: 6, alignItems: "center", marginTop: 6,
            padding: "6px 8px", borderRadius: 8, background: "var(--bg-secondary)",
            overflowX: "auto",
          }}>
            <select
              value={selectedProviderId}
              onChange={(e) => {
                setSelectedProviderId(e.target.value);
                const pm = models.filter((m) => m.providerId === e.target.value);
                if (pm.length > 0) setSelectedModelId(pm[0].id);
              }}
              style={{
                padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                background: "var(--bg-card)", fontSize: 11, maxWidth: 120,
              }}
            >
              {providers.filter((p) => p.enabled).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>/</span>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              style={{
                padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                background: "var(--bg-card)", fontSize: 11, maxWidth: 160,
              }}
            >
              {models.filter((m) => m.providerId === selectedProviderId).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} {m.capabilities.reasoning ? " [思考]" : ""}{m.capabilities.vision ? " [视觉]" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "10px" }}>
        {activeConv?.messages.length === 0 && !streaming && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>开始对话</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>输入消息开始与 AI 交流</div>
          </div>
        )}

        {activeConv?.messages.map((msg) => (
          <div key={msg.id} style={{
            display: "flex", marginBottom: 12,
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: "88%", position: "relative",
            }}>
              {/* Agent info for assistant */}
              {msg.role === "assistant" && msg.agentName && (
                <div style={{
                  fontSize: 11, fontWeight: 600, color: msg.agentColor || "var(--text-secondary)",
                  marginBottom: 3, display: "flex", alignItems: "center", gap: 4,
                }}>
                  {msg.agentAvatar && <span>{msg.agentAvatar}</span>}
                  {msg.agentName}
                </div>
              )}

              {/* Message bubble */}
              <div style={{
                padding: "10px 14px", borderRadius: 16,
                background: msg.role === "user" ? "var(--primary)" : "var(--bg-card)",
                color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                border: msg.role === "user" ? "none" : "1px solid var(--border)",
                fontSize: 13, lineHeight: 1.6,
              }}>
                {msg.role === "user" ? (
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {msg.imageData && (
                      <img src={msg.imageData} alt="附件" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 6 }} />
                    )}
                    {msg.content}
                  </div>
                ) : (
                  <MessageRenderer
                    content={(msg.reasoningContent ? `<think>${msg.reasoningContent}</think>` : "") + msg.content}
                    msgId={msg.id}
                    imageData={msg.imageData}
                    additionalImages={msg.additionalImages}
                    attachedFiles={msg.attachedFiles}
                    collapseThreshold={1500}
                    collapseMaxChars={600}
                  />
                )}
                <div style={{
                  fontSize: 10, marginTop: 4, textAlign: "right",
                  color: msg.role === "user" ? "rgba(255,255,255,.6)" : "var(--text-muted)",
                  display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6,
                }}>
                  {msg.tokenUsage && (
                    <span>{(msg.tokenUsage.prompt + msg.tokenUsage.completion).toLocaleString()} tok</span>
                  )}
                  <span>{formatTime(msg.createdAt)}</span>
                </div>
              </div>

              {/* Message action buttons */}
              <div style={{
                display: "flex", gap: 2, marginTop: 3,
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                <button onClick={() => handleCopyMsg(msg.content)} style={actionBtnStyle} title="复制">
                  <Copy size={11} />
                </button>
                {msg.role === "assistant" && (
                  <>
                    <button onClick={() => speakText(msg.content, msg.agentId)} style={actionBtnStyle} title="朗读">
                      <Volume2 size={11} />
                    </button>
                    <button onClick={() => handleRegenerate(msg)} style={actionBtnStyle} title="重新生成">
                      <RefreshCw size={11} />
                    </button>
                    <button onClick={() => handleBranch(msg)} style={actionBtnStyle} title="分支对话">
                      <GitBranch size={11} />
                    </button>
                  </>
                )}
                <button onClick={() => handleDeleteMsg(msg.id)} style={actionBtnStyle} title="删除">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Streaming content */}
        {streaming && streamContent && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
            <div style={{
              maxWidth: "88%", padding: "10px 14px", borderRadius: 16,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              fontSize: 13, lineHeight: 1.6,
            }}>
              <MessageRenderer content={streamContent} msgId="streaming" collapseThreshold={999999} />
              <span style={{ animation: "pulse 1s infinite", color: "var(--primary)" }}>▊</span>
            </div>
          </div>
        )}

        {streaming && !streamContent && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
            <div style={{
              padding: "10px 14px", borderRadius: 16,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              fontSize: 13, color: "var(--text-muted)",
            }}>
              <span style={{ animation: "pulse 1.5s infinite" }}>思考中...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attached previews */}
      {(attachedImages.length > 0 || attachedFiles.length > 0) && (
        <div style={{
          padding: "6px 10px", borderTop: "1px solid var(--border)",
          background: "var(--bg-card)", display: "flex", gap: 6,
          overflowX: "auto", flexShrink: 0,
        }}>
          {attachedImages.map((img, idx) => (
            <div key={idx} style={{ position: "relative", flexShrink: 0 }}>
              <img src={img.dataUrl} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
              <button onClick={() => setAttachedImages((p) => p.filter((_, i) => i !== idx))} style={{
                position: "absolute", top: -4, right: -4,
                width: 18, height: 18, borderRadius: "50%",
                background: "var(--accent, #f43f5e)", border: "none",
                color: "#fff", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 10,
              }}><X size={10} /></button>
            </div>
          ))}
          {attachedFiles.map((f, idx) => (
            <div key={idx} style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 8px", borderRadius: 8, background: "var(--bg-secondary)",
              border: "1px solid var(--border)", fontSize: 11, flexShrink: 0,
            }}>
              <span>📎 {f.name}</span>
              <button onClick={() => setAttachedFiles((p) => p.filter((_, i) => i !== idx))} style={{
                border: "none", background: "transparent", cursor: "pointer",
                color: "var(--text-muted)", padding: 0, display: "flex",
              }}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: "8px 10px",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
        borderTop: "1px solid var(--border)", background: "var(--bg-card)", flexShrink: 0,
      }}>
        {/* Agent chips */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 6, paddingBottom: 2 }}>
          <button onClick={() => setSelectedAgentId("")} style={chipStyle(!selectedAgentId)}>
            自由
          </button>
          {agents.map((a) => (
            <button key={a.id} onClick={() => setSelectedAgentId(a.id)} style={chipStyle(selectedAgentId === a.id)}>
              {a.avatar} {a.name}
            </button>
          ))}
        </div>

        {/* Skill picker */}
        {showSkillPicker && installedSkills.length > 0 && (
          <div style={{
            display: "flex", gap: 4, overflowX: "auto", marginBottom: 6, paddingBottom: 2,
          }}>
            <button onClick={() => { setSpecifiedSkill(""); setShowSkillPicker(false); }} style={chipStyle(!specifiedSkill)}>
              自动
            </button>
            {installedSkills.map((s) => (
              <button key={s.id} onClick={() => { setSpecifiedSkill(s.id); setShowSkillPicker(false); }} style={chipStyle(specifiedSkill === s.id)}>
                {s.nameZh}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
          {/* Attachment buttons */}
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={() => imgInputRef.current?.click()} style={attachBtnStyle} title="图片">
              <ImageIcon size={16} />
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={attachBtnStyle} title="文件">
              <Paperclip size={16} />
            </button>
            {installedSkills.length > 0 && (
              <button onClick={() => setShowSkillPicker(!showSkillPicker)} style={{
                ...attachBtnStyle,
                color: specifiedSkill ? "var(--primary)" : "var(--text-muted)",
              }} title="指定 Skill">
                ⚡
              </button>
            )}
          </div>

          <input ref={imgInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display: "none" }} />
          <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} style={{ display: "none" }} />

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            onPaste={handlePaste}
            placeholder={attachedImages.length > 0 ? "添加文字说明（可选）..." : "输入消息..."}
            rows={1}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 16,
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)", color: "var(--text-primary)",
              fontSize: 14, resize: "none", outline: "none",
              fontFamily: "inherit", lineHeight: 1.4, maxHeight: 100,
            }}
          />

          {streaming ? (
            <button onClick={handleStop} style={sendBtnStyle("var(--accent, #f43f5e)")}>
              <StopCircle size={18} />
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim() && attachedImages.length === 0 && attachedFiles.length === 0}
              style={sendBtnStyle(
                input.trim() || attachedImages.length > 0 || attachedFiles.length > 0
                  ? "var(--primary)"
                  : "var(--bg-active)"
              )}
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const actionBtnStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "4px 6px", border: "none", background: "transparent",
  color: "var(--text-muted)", cursor: "pointer", borderRadius: 4,
  fontSize: 11,
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: "4px 10px", borderRadius: 12, border: "none", fontSize: 11,
  whiteSpace: "nowrap", cursor: "pointer",
  background: active ? "var(--primary)" : "var(--bg-secondary)",
  color: active ? "#fff" : "var(--text-secondary)",
});

const attachBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)",
  background: "var(--bg-card)", color: "var(--text-muted)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};

const sendBtnStyle = (bg: string): React.CSSProperties => ({
  width: 40, height: 40, borderRadius: "50%", border: "none",
  background: bg, color: "#fff", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
});
