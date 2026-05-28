import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, Image, Loader2, Play, RefreshCw, Search, Send, Square, Volume2, VolumeX } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, formatTime, getProviderIcon, uid } from "../lib/shared";
import { saveProviders } from "../core/persistence";
import { saveConversation } from "../core/persistence";
import type { ChatMessage } from "../core/types";

export function ChatView() {
  const store = useStore();
  const {
    providers, setProviders, models, conversations, setConversations,
    activeConvId, agents, selectedAgentId, setSelectedAgentId,
    selectedProviderId, setSelectedProviderId, selectedModelId, setSelectedModelId,
    agentModelConfigs, setAgentModelConfigs, agentTTSConfigs,
    ttsEnabled, setTtsEnabled, ttsPlaying, setTtsPlaying,
    getEffectiveConfig, createConversation, setView, showToast,
    syncProvidersToServer,
  } = store;

  const activeConversation = conversations.find((c) => c.id === activeConvId) ?? null;
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingAgent, setStreamingAgent] = useState<{ id: string; name: string; color: string; avatar: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSpokenMsgRef = useRef<string>("");
  const [continuousTts, setContinuousTts] = useState(false);
  const continuousTtsRef = useRef(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-select first provider+model
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

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [activeConversation?.messages, streamingContent]);

  // Auto-speak
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
  }, [activeConversation?.messages, ttsEnabled, agentTTSConfigs]); // eslint-disable-line

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("目前仅支持图片上传", "error"); return; }
    if (file.size > 10 * 1024 * 1024) { showToast("文件大小不能超过 10MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const renderCitations = (content: string) => {
    // Extract URLs from content that look like citations
    const urlRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    const urls: Array<{ text: string; url: string }> = [];
    let match;
    while ((match = urlRegex.exec(content)) !== null) {
      urls.push({ text: match[1], url: match[2] });
    }
    if (urls.length === 0) return null;
    return (
      <div style={{ marginTop: 6, padding: "4px 8px", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)", fontSize: 11 }}>
        <div style={{ color: "var(--text-muted)", marginBottom: 3, fontSize: 10 }}>📎 来源引用:</div>
        {urls.map((u, i) => (
          <a key={i} href={u.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--primary)", marginRight: 8, fontSize: 11 }}>
            <ExternalLink size={10} /> {u.text.slice(0, 40)}
          </a>
        ))}
      </div>
    );
  };

  const copyToClipboard = async (text: string) => {
    try { await navigator.clipboard.writeText(text); showToast("已复制到剪贴板", "success"); } catch { showToast("复制失败", "error"); }
  };

  const speakText = useCallback(async (text: string, agentId?: string) => {
    const agentTTS = agentId ? agentTTSConfigs.find((c) => c.agentId === agentId) : undefined;
    if (!ttsEnabled && !agentTTS?.enabled) return;
    const voice = agentTTS?.voice ?? "mimo_default";
    const stylePrompt = agentTTS?.stylePrompt;
    const speed = agentTTS?.speed;
    setTtsPlaying(true);
    try {
      const resp = await apiFetch("/api/tts", {
        method: "POST",
        body: JSON.stringify({ text: text.slice(0, 2000), voice, stylePrompt: stylePrompt || undefined, speed, format: "wav", agentId }),
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
  }, [ttsEnabled, agentTTSConfigs, setTtsPlaying, showToast]);

  const startContinuousTts = useCallback(async () => {
    if (!activeConversation) return;
    setContinuousTts(true);
    continuousTtsRef.current = true;
    const messages = activeConversation.messages.filter((m) => m.role === "assistant" && m.content && m.content !== "(无响应)");
    for (const msg of messages) {
      if (!continuousTtsRef.current) break;
      await speakText(msg.content, msg.agentId);
      // Wait for current playback to finish
      while (useStore.getState().ttsPlaying && continuousTtsRef.current) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    setContinuousTts(false);
    continuousTtsRef.current = false;
  }, [activeConversation, speakText]);

  const stopContinuousTts = useCallback(() => {
    setContinuousTts(false);
    continuousTtsRef.current = false;
  }, []);

  const sendChatMessage = useCallback(async (message: string) => {
    if (!message.trim() && !attachedImage) return;
    const imagePrefix = attachedImage ? `[图片已附加] ` : "";
    const fullMessage = imagePrefix + message;
    let conv = activeConversation;
    if (!conv) conv = createConversation("chat", message.slice(0, 30));

    const userMsg: ChatMessage = { id: uid(), role: "user", content: fullMessage, createdAt: new Date().toISOString() };
    const updatedMessages = [...conv.messages, userMsg];
    const updatedConv = { ...conv, messages: updatedMessages, updatedAt: new Date().toISOString() };
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === updatedConv.id);
      const next = idx >= 0 ? prev.map((c) => c.id === updatedConv.id ? updatedConv : c) : [updatedConv, ...prev];
      saveConversation(updatedConv);
      return next;
    });

    setChatInput("");
    setAttachedImage(null);
    setStreaming(true);
    setStreamingContent("");
    setStreamingAgent(null);

    try {
      const cfg = getEffectiveConfig(selectedAgentId);
      const resp = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ conversationId: conv.id, message: fullMessage, agentId: selectedAgentId, providerId: cfg.providerId, model: cfg.modelId }),
      });
      if (!resp.ok) { const err = await resp.json() as { error: string }; throw new Error(err.error); }

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
          if (line.startsWith("event: ")) { currentEvent = line.slice(7).trim(); continue; }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === "text" && data.content) {
                fullContent += data.content;
                setStreamingContent(fullContent);
                if (data.agentName) setStreamingAgent({ id: data.agentId, name: data.agentName, color: data.agentColor, avatar: data.agentAvatar ?? "🤖" });
              } else if (currentEvent === "error") throw new Error(data.error);
            } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
          }
        }
      }

      const agent = agents.find((a) => a.id === selectedAgentId);
      const assistantMsg: ChatMessage = {
        id: uid(), role: "assistant", content: fullContent || "(无响应)",
        agentId: agent?.id, agentName: agent?.name, agentColor: agent?.color, agentAvatar: agent?.avatar,
        createdAt: new Date().toISOString(),
      };
      const finalMessages = [...updatedMessages, assistantMsg];
      const finalConv = { ...updatedConv, messages: finalMessages, updatedAt: new Date().toISOString() };
      setConversations((prev) => prev.map((c) => c.id === finalConv.id ? finalConv : c));
      saveConversation(finalConv);
    } catch (err) {
      const errorMsg: ChatMessage = { id: uid(), role: "system", content: `错误: ${err instanceof Error ? err.message : String(err)}`, createdAt: new Date().toISOString() };
      const finalConv = { ...updatedConv, messages: [...updatedMessages, errorMsg], updatedAt: new Date().toISOString() };
      setConversations((prev) => prev.map((c) => c.id === finalConv.id ? finalConv : c));
      saveConversation(finalConv);
    } finally {
      setStreaming(false);
      setStreamingContent("");
      setStreamingAgent(null);
    }
  }, [activeConversation, streaming, selectedAgentId, agents, getEffectiveConfig, createConversation, setConversations]);

  const hasConfiguredProvider = providers.some((p) => p.enabled && (p.apiKey || p.type === "ollama"));
  const availableModels = selectedProviderId
    ? models.filter((m) => m.providerId === selectedProviderId)
    : models.filter((m) => providers.some((p) => p.id === m.providerId && p.enabled));

  return (
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
                      return <span className="msg-model-badge">{getProviderIcon(provider?.type ?? "")} {modelId}</span>;
                    })()}
                  </div>
                )}
                <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                {msg.role === "assistant" && renderCitations(msg.content)}
                {msg.role === "assistant" && (
                  <div style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center" }}>
                    <button className="icon-btn" onClick={() => copyToClipboard(msg.content)} title="复制" style={{ fontSize: 11, padding: "2px 4px", display: "inline-flex", alignItems: "center" }}>
                      <Copy size={12} />
                    </button>
                    <button className="icon-btn" onClick={() => {
                      const msgIdx = activeConversation?.messages.findIndex((m) => m.id === msg.id);
                      const prevUserMsg = msgIdx && activeConversation ? activeConversation.messages.slice(0, msgIdx).reverse().find((m) => m.role === "user") : null;
                      if (prevUserMsg) sendChatMessage(prevUserMsg.content);
                    }} title="重新生成" style={{ fontSize: 11, padding: "2px 4px", display: "inline-flex", alignItems: "center" }}>
                      <RefreshCw size={12} />
                    </button>
                    {(ttsEnabled || agentTTSConfigs.find((c) => c.agentId === msg.agentId)?.enabled) && (
                      <button className="icon-btn" style={{ fontSize: 11, padding: "2px 4px", display: "inline-flex", alignItems: "center" }} onClick={() => speakText(msg.content, msg.agentId)} disabled={ttsPlaying} title="朗读此消息">
                        {ttsPlaying ? "⏳" : <Volume2 size={12} />}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="msg-time">{formatTime(msg.createdAt)}</div>
            </div>
          </div>
        ))}
        {streaming && streamingContent && (
          <div className="msg-row assistant">
            <div className="msg-avatar" style={{ background: streamingAgent?.color ?? "#4ECDC4" }}>{streamingAgent?.avatar ?? "🤖"}</div>
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
            <div className="msg-bubble"><div className="typing-indicator"><span className="dot" /><span className="dot" /><span className="dot" /></div></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        {attachedImage && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: 8, borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <img src={attachedImage} alt="预览" style={{ maxWidth: 80, maxHeight: 60, borderRadius: 4, objectFit: "cover" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>已附加图片</span>
            <button className="icon-btn" onClick={() => setAttachedImage(null)} style={{ fontSize: 11 }}>✕</button>
          </div>
        )}
        <div className="chat-input-wrapper">
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileSelect} style={{ display: "none" }} />
          <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="附加图片" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
            <Image size={16} />
          </button>
          <textarea className="chat-input" placeholder={`与 ${agents.find((a) => a.id === selectedAgentId)?.name ?? "Agent"} 对话...`} value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(chatInput); } }} rows={1} disabled={streaming} />
          <button className="primary" onClick={() => sendChatMessage(chatInput)} disabled={streaming || (!chatInput.trim() && !attachedImage)} style={{ borderRadius: 10, padding: "10px 16px" }}>
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
            <div className="model-selector-group">
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {getProviderIcon(providers.find((p) => p.id === (agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal)?.providerId ?? selectedProviderId))?.type ?? "")}
              </span>
              <select value={agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal)?.providerId ?? selectedProviderId} onChange={(e) => {
                const v = e.target.value;
                const existingCfg = agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal);
                if (existingCfg) {
                  const provModels = models.filter((m) => m.providerId === v);
                  const newConfigs = agentModelConfigs.map((c) => c.agentId === selectedAgentId ? { ...c, providerId: v, modelId: provModels[0]?.id ?? "" } : c);
                  setAgentModelConfigs(newConfigs);
                  apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: newConfigs }) });
                } else {
                  setSelectedProviderId(v);
                  const provModels = models.filter((m) => m.providerId === v);
                  setSelectedModelId(provModels[0]?.id ?? "");
                }
              }}>
                <option value="">全局</option>
                {providers.filter((p) => p.enabled).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span style={{ fontSize: 10, color: "var(--border)" }}>|</span>
              <select value={agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal)?.modelId ?? selectedModelId} onChange={(e) => {
                const v = e.target.value;
                const existingCfg = agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal);
                if (existingCfg) {
                  const newConfigs = agentModelConfigs.map((c) => c.agentId === selectedAgentId ? { ...c, modelId: v } : c);
                  setAgentModelConfigs(newConfigs);
                  apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: newConfigs }) });
                } else { setSelectedModelId(v); }
              }}>
                {(() => {
                  const cfgProviderId = agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal)?.providerId ?? selectedProviderId;
                  const cfgModels = models.filter((m) => m.providerId === cfgProviderId);
                  if (cfgModels.length === 0) return <option value="">无模型</option>;
                  return cfgModels.map((m) => <option key={m.id} value={m.id}>{m.id}</option>);
                })()}
              </select>
            </div>
            {(() => {
              const cfgProviderId = agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal)?.providerId ?? selectedProviderId;
              const cfgProvider = providers.find((p) => p.id === cfgProviderId);
              if (cfgProvider?.type !== "xiaomi-mimo") return null;
              return (
                <button className="icon-btn" onClick={() => {
                  const updated = { ...cfgProvider, webSearchEnabled: !cfgProvider.webSearchEnabled };
                  const newProviders = providers.map((pp) => pp.id === cfgProvider.id ? updated : pp);
                  setProviders(newProviders);
                  saveProviders(newProviders);
                  syncProvidersToServer();
                }} title={cfgProvider.webSearchEnabled ? "关闭联网搜索" : "开启联网搜索"} style={{ color: cfgProvider.webSearchEnabled ? "var(--primary)" : "var(--text-muted)" }}>
                  <Search size={14} />
                </button>
              );
            })()}
            {ttsEnabled && (
              <button className="icon-btn" onClick={continuousTts ? stopContinuousTts : startContinuousTts} title={continuousTts ? "停止连续朗读" : "连续朗读全部"} style={{ color: continuousTts ? "var(--accent)" : "var(--text-muted)" }}>
                {continuousTts ? <Square size={12} /> : <Play size={12} />}
              </button>
            )}
            <button className={`icon-btn ${ttsEnabled ? "tts-active" : ""}`} onClick={() => setTtsEnabled(!ttsEnabled)} title={ttsEnabled ? "关闭语音朗读" : "开启语音朗读"} style={{ color: ttsEnabled ? "var(--primary)" : "var(--text-muted)" }}>
              {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
