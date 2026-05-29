import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Copy, ExternalLink, GitBranch, Image, Loader2, Play, RefreshCw, Search, Send, Square, StopCircle, Volume2, VolumeX, X, ZoomIn } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, formatTime, getProviderIcon, uid } from "../lib/shared";
import { saveProviders, saveConversation } from "../core/persistence";
import { compressImage, formatBytes } from "../lib/imageCompress";
import type { CompressResult } from "../lib/imageCompress";
import type { ChatMessage } from "../core/types";
import { UserIcon, BotIcon, BrainIcon, ZapIcon, EyeIcon, FileIcon, LinkIcon, ChatIcon } from "../components/icons";
import { estimateTokens } from "../core/tokenCounter";

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
    branchConversation,
    skills,
    updateTokenUsage,
    tokenUsageByConv,
  } = store;

  const activeConversation = conversations.find((c) => c.id === activeConvId) ?? null;
  const convTokenUsage = activeConvId ? (tokenUsageByConv[activeConvId] ?? { promptTokens: 0, completionTokens: 0, cachedTokens: 0, compressionSaved: 0 }) : null;
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingAgent, setStreamingAgent] = useState<{ id: string; name: string; color: string; avatar: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSpokenMsgRef = useRef<string>("");
  const [continuousTts, setContinuousTts] = useState(false);
  const continuousTtsRef = useRef(false);
  const [attachedImages, setAttachedImages] = useState<Array<{ dataUrl: string; rawFile: File; info: string }>>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);  // lightbox
  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; type: string; size: number; content?: string; base64?: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(new Set());
  const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
  const [specifiedSkill, setSpecifiedSkill] = useState<string>("");
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatAreaRef = useRef<HTMLDivElement>(null);

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
  // Cleanup: abort streaming on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);


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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await processFile(file);
    }
    e.target.value = "";
  };

  const processFile = async (file: File) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImages((prev) => [...prev, { dataUrl: reader.result as string, rawFile: file, info: `${file.name} · ${formatBytes(file.size)}` }]);
      };
      reader.readAsDataURL(file);
    } else {
      // Non-image file: extract content on server
      showToast(`正在处理 ${file.name}...`, "info");
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          const resp = await apiFetch("/api/extract-file", {
            method: "POST",
            body: JSON.stringify({ fileName: file.name, fileType: file.type, base64Data: base64 }),
          });
          if (resp.ok) {
            const data = await resp.json() as { name: string; type: string; size: number; content: string; truncated?: boolean };
            setAttachedFiles((prev) => [...prev, { ...data, base64 }]);
            showToast(`${file.name} 已添加`, "success");
          } else {
            showToast(`文件处理失败`, "error");
          }
        } catch {
          showToast(`文件处理失败`, "error");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag & drop handler
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    for (const file of Array.from(files)) {
      await processFile(file);
    }
  };

  // Clipboard paste handler
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.kind === "file") {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await processFile(file);
      }
    }
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
        <div style={{ color: "var(--text-muted)", marginBottom: 3, fontSize: 10 }}><LinkIcon size={10} /> 来源引用:</div>
        {urls.map((u, i) => (
          <a key={i} href={u.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--primary)", marginRight: 8, fontSize: 11 }}>
            <ExternalLink size={10} /> {u.text.slice(0, 40)}
          </a>
        ))}
      </div>
    );
  };

  const renderMessageContent = (content: string, msgId: string) => {
    const COLLAPSE_THRESHOLD = 800; // chars

    // First, extract thinking blocks (<think>...</think>) and old format ([思考]...[/思考])
    let processedContent = content;
    // Normalize old [思考]...[/思考] format to <think>...</think>
    processedContent = processedContent.replace(/\[思考\]([\s\S]*?)\[\/思考\]/g, '<think>$1</think>');

    const thinkingParts = processedContent.split(/(<think>[\s\S]*?<\/think>)/g);
    const thinkingBlocks: string[] = [];
    const textParts: string[] = [];

    for (const part of thinkingParts) {
      const thinkMatch = part.match(/^<think>([\s\S]*?)<\/think>$/);
      if (thinkMatch) {
        thinkingBlocks.push(thinkMatch[1].trim());
      } else if (part.trim()) {
        textParts.push(part);
      }
    }

    const thinkingText = thinkingBlocks.join("\n");
    const mainContent = textParts.join("").trim();
    const isLong = mainContent.length > COLLAPSE_THRESHOLD;
    const isExpanded = expandedMsgs.has(msgId);
    const isThinkingExpanded = expandedThinking.has(msgId);

    // Parse code blocks: ```lang\ncode\n```
    const parts = mainContent.split(/(```[\s\S]*?```)/g);
    const rendered = parts.map((part, i) => {
      const codeMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
      if (codeMatch) {
        const lang = codeMatch[1] || "";
        const code = codeMatch[2].trim();
        return (
          <div key={i} style={{ position: "relative", margin: "6px 0", borderRadius: 8, background: "#1e1e2e", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 10px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              <span style={{ fontSize: 11, color: "#888" }}>{lang || "code"}</span>
              <button className="icon-btn" onClick={() => copyToClipboard(code)} title="复制代码" style={{ fontSize: 11, padding: "2px 6px", color: "#aaa" }}>
                <Copy size={11} />
              </button>
            </div>
            <pre style={{ margin: 0, padding: "10px 12px", overflow: "auto", fontSize: 12, lineHeight: 1.5, color: "#e4e4e7", fontFamily: "var(--font-mono, monospace)" }}>
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      // Inline code: `code`
      const inlineParts = part.split(/(`[^`]+`)/g);
      return (
        <span key={i}>
          {inlineParts.map((ip, j) => {
            const inlineMatch = ip.match(/^`(.+)`$/);
            if (inlineMatch) {
              return <code key={j} style={{ padding: "1px 5px", borderRadius: 4, background: "var(--bg)", border: "1px solid var(--border)", fontSize: "0.9em", fontFamily: "var(--font-mono, monospace)" }}>{inlineMatch[1]}</code>;
            }
            return <span key={j}>{ip}</span>;
          })}
        </span>
      );
    });

    const thinkingPanel = thinkingText ? (
      <div style={{ marginBottom: 8, borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
        <button
          onClick={() => setExpandedThinking((prev) => {
            const n = new Set(prev);
            if (n.has(msgId)) n.delete(msgId); else n.add(msgId);
            return n;
          })}
          style={{
            display: "flex", alignItems: "center", gap: 6, width: "100%",
            padding: "8px 12px", background: "var(--bg)", border: "none", cursor: "pointer",
            fontSize: 12, color: "var(--text-secondary)", fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 14 }}>{isThinkingExpanded ? "▼" : "▶"}</span>
          <span>深度思考</span>
          <span style={{ opacity: 0.5, fontSize: 11 }}>({thinkingText.length} 字)</span>
        </button>
        {isThinkingExpanded && (
          <div style={{ padding: "8px 12px", whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.6, color: "var(--text-secondary)", borderTop: "1px solid var(--border)", maxHeight: 400, overflow: "auto" }}>
            {thinkingText}
          </div>
        )}
      </div>
    ) : null;

    if (isLong && !isExpanded) {
      return (
        <div>
          {thinkingPanel}
          <div style={{ whiteSpace: "pre-wrap", maxHeight: 300, overflow: "hidden", position: "relative" }}>
            {rendered}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(transparent, var(--bg-card))" }} />
          </div>
          <button className="icon-btn" onClick={() => setExpandedMsgs((prev) => new Set(prev).add(msgId))} style={{ fontSize: 12, color: "var(--primary)", marginTop: 4 }}>
            <ChevronDown size={14} /> 展开全文 ({mainContent.length} 字)
          </button>
        </div>
      );
    }

    return (
      <div>
        {thinkingPanel}
        <div style={{ whiteSpace: "pre-wrap" }}>{rendered}</div>
        {isLong && isExpanded && (
          <button className="icon-btn" onClick={() => setExpandedMsgs((prev) => { const n = new Set(prev); n.delete(msgId); return n; })} style={{ fontSize: 12, color: "var(--primary)", marginTop: 4 }}>
            <ChevronUp size={14} /> 收起
          </button>
        )}
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
        body: JSON.stringify({ text: text.slice(0, 2000), voice, stylePrompt: stylePrompt || undefined, speed, format: "wav", agentId, ttsProviderId: agentTTS?.ttsProviderId }),
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
    if (!message.trim() && attachedImages.length === 0 && attachedFiles.length === 0) return;
    const imageDataList: string[] = [];
    for (const img of attachedImages) {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(img.rawFile);
      });
      imageDataList.push(dataUrl);
    }

    const fileNames = attachedFiles.map((f) => f.name).join(", ");
    const prefix = [
      imageDataList.length > 0 ? `[${imageDataList.length}张图片已附加] ` : "",
      fileNames ? `[文件: ${fileNames}] ` : "",
    ].join("");
    const fullMessage = prefix + message;
    let conv = activeConversation;
    if (!conv) conv = createConversation("chat", message.slice(0, 30));

    const userMsg: ChatMessage = { id: uid(), role: "user", content: fullMessage, imageData: imageDataList[0] ?? undefined, additionalImages: imageDataList.length > 1 ? imageDataList.slice(1) : undefined, attachedFiles: attachedFiles.length > 0 ? attachedFiles.map((f) => ({ name: f.name, type: f.type, size: f.size, content: f.content })) : undefined, createdAt: new Date().toISOString() };
    const updatedMessages = [...conv.messages, userMsg];
    const updatedConv = { ...conv, messages: updatedMessages, updatedAt: new Date().toISOString() };
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === updatedConv.id);
      const next = idx >= 0 ? prev.map((c) => c.id === updatedConv.id ? updatedConv : c) : [updatedConv, ...prev];
      saveConversation(updatedConv);
      return next;
    });

    setChatInput("");
    setAttachedImages([]);
    setAttachedFiles([]);
    setSpecifiedSkill("");
    setShowSkillPicker(false);
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setStreamingContent("");
    setStreamingAgent(null);

    const cfg = getEffectiveConfig(selectedAgentId);
    try {
      const resp = await apiFetch("/api/chat", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
        conversationId: conv.id,
        message: fullMessage,
        agentId: selectedAgentId,
        providerId: cfg.providerId,
        model: cfg.modelId,
        imageData: imageDataList[0] ?? undefined,
        additionalImages: imageDataList.length > 1 ? imageDataList.slice(1) : undefined,
        attachedFiles: attachedFiles.length > 0 ? attachedFiles.map((f) => ({ name: f.name, type: f.type, size: f.size, content: f.content })) : undefined,
        specifiedSkill: specifiedSkill || undefined,
      }),
      });
      if (!resp.ok) { const err = await resp.json() as { error: string }; throw new Error(err.error); }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let lastUsage: { prompt: number; completion: number; cached: number } | null = null;

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
                if (data.agentName) setStreamingAgent({ id: data.agentId, name: data.agentName, color: data.agentColor, avatar: data.agentAvatar ?? "✦" });
              } else if (currentEvent === "usage" && data.usage) {
                // Track token usage from server SSE
                const usageData = {
                  prompt: data.usage.prompt ?? 0,
                  completion: data.usage.completion ?? 0,
                  cached: data.usage.cachedTokens ?? 0,
                };
                lastUsage = usageData;
                if (activeConvId) {
                  updateTokenUsage(activeConvId, usageData);
                }
              } else if (currentEvent === "error") throw new Error(data.error);
            } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
          }
        }
      }

      // Fallback: estimate tokens if provider didn't return usage data
      if (!lastUsage && fullContent) {
        const userMsgTokens = estimateTokens(chatInput);
        const assistantTokens = estimateTokens(fullContent);
        const estimatedUsage = { prompt: userMsgTokens, completion: assistantTokens, cached: 0 };
        lastUsage = estimatedUsage;
        if (activeConvId) {
          updateTokenUsage(activeConvId, estimatedUsage);
        }
      }

      const agent = agents.find((a) => a.id === selectedAgentId);
      const assistantMsg: ChatMessage = {
        id: uid(), role: "assistant", content: fullContent || "(无响应)",
        agentId: agent?.id, agentName: agent?.name, agentColor: agent?.color, agentAvatar: agent?.avatar,
        createdAt: new Date().toISOString(),
        tokenUsage: lastUsage ? { prompt: lastUsage.prompt, completion: lastUsage.completion } : undefined,
      };
      const finalMessages = [...updatedMessages, assistantMsg];
      const finalConv = { ...updatedConv, messages: finalMessages, updatedAt: new Date().toISOString() };
      setConversations((prev) => prev.map((c) => c.id === finalConv.id ? finalConv : c));
      saveConversation(finalConv);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // If failure might be due to image size, try compressing and retrying
      if (attachedImages.length > 0 && (errMsg.includes("413") || errMsg.includes("too large") || errMsg.includes("payload") || errMsg.includes("size"))) {
        try {
          showToast("原图过大，正在压缩重试...", "info");
          const compressed = await compressImage(attachedImages[0].rawFile, { maxDimension: 1024, quality: 0.85, maxBytes: 2 * 1024 * 1024 });
          const retryResp = await apiFetch("/api/chat", {
            method: "POST",
            body: JSON.stringify({ conversationId: conv.id, message: fullMessage, agentId: selectedAgentId, providerId: cfg.providerId, model: cfg.modelId, imageData: compressed.dataUrl, attachedFiles: attachedFiles.length > 0 ? attachedFiles.map((f) => ({ name: f.name, type: f.type, size: f.size, content: f.content })) : undefined }),
          });
          if (retryResp.ok) {
            // Process retry response (simplified - read all at once)
            const retryData = await retryResp.json() as { content?: string };
            const agent = agents.find((a) => a.id === selectedAgentId);
            const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: retryData.content || "(压缩重试成功)", agentId: agent?.id, agentName: agent?.name, agentColor: agent?.color, agentAvatar: agent?.avatar, createdAt: new Date().toISOString() };
            const finalConv2 = { ...updatedConv, messages: [...updatedMessages, assistantMsg], updatedAt: new Date().toISOString() };
            setConversations((prev) => prev.map((c) => c.id === finalConv2.id ? finalConv2 : c));
            saveConversation(finalConv2);
            const compInfo = ` (已压缩: ${formatBytes(compressed.originalSize)} → ${formatBytes(compressed.compressedSize)})`;
            showToast(`压缩重试成功${compInfo}`, "success");
            return;
          }
        } catch {
          // Compression retry also failed
        }
      }
      const errorMsg: ChatMessage = { id: uid(), role: "system", content: `错误: ${errMsg}`, createdAt: new Date().toISOString() };
      const finalConv = { ...updatedConv, messages: [...updatedMessages, errorMsg], updatedAt: new Date().toISOString() };
      setConversations((prev) => prev.map((c) => c.id === finalConv.id ? finalConv : c));
      saveConversation(finalConv);
    } finally {
      setStreaming(false);
      setStreamingContent("");
      setStreamingAgent(null);
    }
  }, [activeConversation, streaming, selectedAgentId, agents, attachedImages, getEffectiveConfig, createConversation, setConversations, showToast]);

  const hasConfiguredProvider = providers.some((p) => p.enabled && (p.apiKey || p.type === "ollama"));
  const availableModels = selectedProviderId
    ? models.filter((m) => m.providerId === selectedProviderId)
    : models.filter((m) => providers.some((p) => p.id === m.providerId && p.enabled));

  // Provider status for debugging
  const mimoProvider = providers.find((p) => p.type === "xiaomi-mimo");
  const enabledCount = providers.filter((p) => p.enabled).length;

  return (
    <div className="chat-container">
      {/* Provider status bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 16px", background: "var(--bg-card)", borderBottom: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
        <span>供应商: {providers.length} 个 ({enabledCount} 已启用)</span>
        {mimoProvider && <span style={{ color: "var(--primary)" }}>✓ MiMo {mimoProvider.enabled ? "已启用" : "未启用"}</span>}
        {!mimoProvider && <span style={{ color: "var(--accent)" }}>✗ MiMo 未加载</span>}
        <span style={{ marginLeft: "auto" }}>{getProviderIcon(providers.find((p) => p.id === (agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal)?.providerId ?? selectedProviderId))?.type ?? "")} {models.find((m) => m.id === (agentModelConfigs.find((c) => c.agentId === selectedAgentId && !c.useGlobal)?.modelId ?? selectedModelId))?.id ?? "未选模型"}</span>
      </div>
      {/* Agent header for 1v1 context */}
      {(() => {
        const currentAgent = agents.find((a) => a.id === selectedAgentId) ?? (selectedAgentId ? null : { id: "", name: "自由对话", avatar: "✦", role: "free" as const, color: "#4ECDC4", goal: "", systemPrompt: "" });
        if (!currentAgent) return null;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: currentAgent.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{currentAgent.avatar}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{currentAgent.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{currentAgent.role} · {currentAgent.goal?.slice(0, 50) || currentAgent.systemPrompt?.slice(0, 50)}</div>
            </div>
            <div style={{ flex: 1 }} />
            {(() => {
              const cfg = getEffectiveConfig(selectedAgentId);
              const provider = cfg.provider;
              if (!cfg.modelId) return null;
              return <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{getProviderIcon(provider?.type ?? "")} {cfg.modelId}</span>;
            })()}
          </div>
        );
      })()}
      <div className="chat-messages">
        {(!activeConversation || activeConversation.messages.length === 0) && (
          <div className="empty-state">
            <div className="empty-icon"><BotIcon size={48} /></div>
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
              {msg.role === "user" ? <UserIcon size={16} /> : (msg.agentAvatar ?? <BotIcon size={16} />)}
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
                {(msg.imageData || (msg.additionalImages && msg.additionalImages.length > 0)) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                    {msg.imageData && (
                      <img src={msg.imageData} alt="attached" style={{ maxWidth: 300, maxHeight: 200, borderRadius: 8, cursor: "pointer", objectFit: "contain" }} onClick={() => setPreviewImage(msg.imageData!)} />
                    )}
                    {msg.additionalImages?.map((img, idx) => (
                      <img key={idx} src={img} alt={`attached-${idx}`} style={{ maxWidth: 300, maxHeight: 200, borderRadius: 8, cursor: "pointer", objectFit: "contain" }} onClick={() => setPreviewImage(img)} />
                    ))}
                  </div>
                )}
                {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                    {msg.attachedFiles.map((f, i) => (
                      <span key={i} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "var(--bg)", border: "1px solid var(--border)" }}><FileIcon size={12} /> {f.name}</span>
                    ))}
                  </div>
                )}
                {renderMessageContent(msg.content.replace(/\[图片已附加\]\s*/g, "").replace(/\[文件:[^\]]+\]\s*/g, "").replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\[思考\][\s\S]*?\[\/思考\]/g, "").trim(), msg.id)}
                {msg.role === "assistant" && renderCitations(msg.content.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/\[思考\][\s\S]*?\[\/思考\]/g, ""))}
                {msg.role === "assistant" && (
                  <div style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center" }}>
                    <button className="icon-btn" onClick={() => copyToClipboard(msg.content)} title="复制" style={{ fontSize: 11, padding: "2px 4px", display: "inline-flex", alignItems: "center" }}>
                      <Copy size={12} />
                    </button>
                    <button className="icon-btn" onClick={() => {
                      const msgIdx = activeConversation?.messages.findIndex((m) => m.id === msg.id);
                      const prevUserMsg = msgIdx && activeConversation ? activeConversation.messages.slice(0, msgIdx).reverse().find((m) => m.role === "user") : null;
                      if (prevUserMsg) {
                        // Send without image prefix (raw content)
                        setChatInput(prevUserMsg.content);
                      }
                    }} title="重新生成" style={{ fontSize: 11, padding: "2px 4px", display: "inline-flex", alignItems: "center" }}>
                      <RefreshCw size={12} />
                    </button>
                    <button className="icon-btn" onClick={() => {
                      if (activeConvId) {
                        const branched = branchConversation(activeConvId, msg.id);
                        showToast(`已创建分支对话: ${branched.title}`, "success");
                      }
                    }} title="从此消息分支" style={{ fontSize: 11, padding: "2px 4px", display: "inline-flex", alignItems: "center" }}>
                      <GitBranch size={12} />
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
                {msg.tokenUsage && (
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ padding: "1px 6px", borderRadius: 4, background: "var(--bg)", border: "1px solid var(--border)", fontSize: 10 }}>
                      ↑{msg.tokenUsage.prompt.toLocaleString()} 输入
                    </span>
                    <span style={{ padding: "1px 6px", borderRadius: 4, background: "var(--bg)", border: "1px solid var(--border)", fontSize: 10 }}>
                      ↓{msg.tokenUsage.completion.toLocaleString()} 输出
                    </span>
                  </div>
                )}
            </div>
          </div>
        ))}
        {streaming && streamingContent && (
          <div className="msg-row assistant">
            <div className="msg-avatar" style={{ background: streamingAgent?.color ?? "#4ECDC4" }}>{streamingAgent?.avatar ?? <BotIcon size={16} />}</div>
            <div>
              <div className="msg-bubble">
                {streamingAgent && <div className="msg-agent-name" style={{ color: streamingAgent.color }}>{streamingAgent.avatar} {streamingAgent.name}<span className="streaming-dot" /></div>}
                {(() => {
                  // Extract thinking from streaming content
                  const thinkMatch = streamingContent.match(/^(<think>[\s\S]*?<\/think>)([\s\S]*)$/s);
                  if (thinkMatch) {
                    const thinkText = thinkMatch[1].replace(/<think>|<\/think>/g, "").trim();
                    const mainText = thinkMatch[2].trim();
                    return (
                      <>
                        <div style={{ marginBottom: 6, padding: "6px 10px", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)", fontSize: 11, color: "var(--text-secondary)" }}>
                          <span style={{ marginRight: 4 }}><BrainIcon size={14} /></span>深度思考中... ({thinkText.length} 字)
                        </div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{mainText}<span className="streaming-dot" /></div>
                      </>
                    );
                  }
                  return <div style={{ whiteSpace: "pre-wrap" }}>{streamingContent}<span className="streaming-dot" /></div>;
                })()}
              </div>
            </div>
          </div>
        )}
        {streaming && !streamingContent && (
          <div className="msg-row assistant">
            <div className="msg-avatar" style={{ background: "#4ECDC4", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="14" rx="3" fill="currentColor"/><circle cx="9" cy="13" r="1.5" fill="white"/><circle cx="15" cy="13" r="1.5" fill="white"/><rect x="10" y="2" width="4" height="4" rx="2" fill="currentColor"/></svg></div>
            <div className="msg-bubble"><div className="typing-indicator"><span className="dot" /><span className="dot" /><span className="dot" /></div></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      {/* Token Usage Summary Bar */}
      {convTokenUsage && (convTokenUsage.promptTokens > 0 || convTokenUsage.completionTokens > 0) && (
        <div style={{
          display: "flex", gap: 16, padding: "8px 20px", fontSize: 12,
          color: "var(--text-secondary)", justifyContent: "center", flexWrap: "wrap",
          borderTop: "1px solid var(--border)", background: "var(--bg-card)",
        }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="12" width="4" height="9" rx="1" fill="currentColor" opacity="0.6"/><rect x="10" y="6" width="4" height="15" rx="1" fill="currentColor" opacity="0.8"/><rect x="17" y="3" width="4" height="18" rx="1" fill="currentColor"/></svg>
            <span>输入 <strong>{convTokenUsage.promptTokens.toLocaleString()}</strong></span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2z" fill="currentColor"/></svg>
            <span>输出 <strong>{convTokenUsage.completionTokens.toLocaleString()}</strong></span>
          </span>
          {convTokenUsage.cachedTokens > 0 && (
            <span style={{ color: "#4ade80", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
              缓存命中 <strong>{convTokenUsage.cachedTokens.toLocaleString()}</strong>
            </span>
          )}
          {convTokenUsage.compressionSaved > 0 && (
            <span style={{ color: "#94a3b8" }}>
              压缩节省 <strong>{convTokenUsage.compressionSaved.toLocaleString()}</strong>
            </span>
          )}
        </div>
      )}

      <div className="chat-input-area">
        {(attachedImages.length > 0 || attachedFiles.length > 0) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8, padding: 8, borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            {attachedImages.map((img, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <img src={img.dataUrl} alt="预览" style={{ maxWidth: 60, maxHeight: 45, borderRadius: 4, objectFit: "cover", cursor: "pointer" }} onClick={() => setPreviewImage(img.dataUrl)} />
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{img.info}</span>
                <button className="icon-btn" onClick={() => setAttachedImages((prev) => prev.filter((_, i) => i !== idx))} style={{ fontSize: 11 }}>✕</button>
              </div>
            ))}
            {attachedFiles.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 6px", borderRadius: 4, background: "var(--bg)", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: 11 }}><FileIcon size={12} /> {f.name}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{formatBytes(f.size)}</span>
                <button className="icon-btn" onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))} style={{ fontSize: 10 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        {/* Skill 选择器 */}
        {showSkillPicker && (
          <div style={{ marginBottom: 6, padding: 8, borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>🎯 指定使用技能（可选）：</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              <button className={`agent-chip ${specifiedSkill === "" ? "selected" : ""}`} onClick={() => setSpecifiedSkill("")} style={{ fontSize: 11, padding: "3px 8px" }}>自动判断</button>
              {skills.filter((s) => s.installed).map((s) => (
                <button key={s.id} className={`agent-chip ${specifiedSkill === s.nameZh ? "selected" : ""}`} onClick={() => setSpecifiedSkill(s.nameZh)} style={{ fontSize: 11, padding: "3px 8px" }}>{s.nameZh}</button>
              ))}
            </div>
          </div>
        )}
        <div className="chat-input-wrapper" onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <input type="file" ref={fileInputRef} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.txt,.md,.json,.ts,.tsx,.js,.py,.rs,.go,.java" multiple onChange={handleFileSelect} style={{ display: "none" }} />
          <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="附加文件 (图片/PDF/Excel/Word/ZIP)" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
            <Image size={16} />
          </button>
          <textarea className="chat-input" placeholder={selectedAgentId ? `与 ${agents.find((a) => a.id === selectedAgentId)?.name ?? "Agent"} 对话...` : "自由对话..."} value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(chatInput); } }} onPaste={handlePaste} rows={1} disabled={streaming} />
          {streaming ? (
            <button className="primary" onClick={() => { abortRef.current?.abort(); setStreaming(false); setStreamingContent(""); setStreamingAgent(null); }} style={{ borderRadius: 10, padding: "10px 16px", background: "var(--accent)" }}>
              <StopCircle size={16} />
            </button>
          ) : (
            <button className="primary" onClick={() => sendChatMessage(chatInput)} disabled={!chatInput.trim() && attachedImages.length === 0} style={{ borderRadius: 10, padding: "10px 16px" }}>
              <Send size={16} />
            </button>
          )}
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
      {previewImage && (
        <div className="image-lightbox" onClick={() => setPreviewImage(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <button onClick={() => setPreviewImage(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "white", cursor: "pointer", zIndex: 1001 }}>
            <X size={24} />
          </button>
          <img src={previewImage} alt="preview" style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
