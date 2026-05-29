import { useState, useRef, useEffect, useCallback } from "react";
import { Send, StopCircle, Plus, ChevronLeft, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, uid, formatTime } from "../lib/shared";

export function MobileChatView() {
  const store = useStore();
  const { conversations, activeConvId, setActiveConvId, providers, agents, selectedAgentId, setSelectedAgentId, createConversation, showToast } = store;
  const activeConv = conversations.find((c) => c.id === activeConvId);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [showConvList, setShowConvList] = useState(!activeConvId);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [activeConv?.messages.length, streamContent, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    const convId = activeConvId ?? createConversation("chat", input.slice(0, 20)).id;
    if (!activeConvId) setActiveConvId(convId);

    const msg = input.trim();
    setInput("");
    setStreaming(true);
    setStreamContent("");

    // Add user message locally
    store.setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: [...c.messages, { id: uid(), role: "user" as const, content: msg, createdAt: new Date().toISOString() }], updatedAt: new Date().toISOString() }
          : c
      )
    );

    try {
      const provider = providers.find((p) => p.enabled && (p.apiKey || p.type === "ollama"));
      if (!provider) { showToast("请先配置 API 密钥", "error"); setStreaming(false); return; }

      const resp = await apiFetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          conversationId: convId, message: msg,
          agentId: selectedAgentId || undefined,
          providerId: provider.id,
        }),
      });

      const reader = resp.body?.getReader();
      if (!reader) { setStreaming(false); return; }

      const decoder = new TextDecoder();
      let full = "";
      let buffer = "";
      let eventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
            continue;
          }
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "text" && data.content) {
                full += data.content;
                setStreamContent(full);
              } else if (eventType === "done") {
                store.setConversations((prev) =>
                  prev.map((c) =>
                    c.id === convId
                      ? { ...c, messages: [...c.messages, { id: data.messageId ?? uid(), role: "assistant" as const, content: full, createdAt: new Date().toISOString() }], updatedAt: new Date().toISOString() }
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
      }
    } catch (err) {
      showToast(`请求失败: ${err instanceof Error ? err.message : "未知错误"}`, "error");
    }
    setStreaming(false);
  };

  // Conversation list view
  if (showConvList || !activeConvId) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>对话</h2>
          <button onClick={() => { createConversation(); setShowConvList(false); }} style={{
            padding: "8px 12px", borderRadius: 8, border: "none",
            background: "var(--primary)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}><Plus size={14} /> 新对话</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
          {conversations.filter((c) => c.type === "chat").sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map((c) => (
            <button key={c.id} onClick={() => { setActiveConvId(c.id); setShowConvList(false); }} style={{
              display: "flex", alignItems: "center", width: "100%", padding: "12px 14px",
              border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
              borderBottom: "1px solid var(--border-subtle)",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>{c.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {c.messages.length} 条消息 · {new Date(c.updatedAt).toLocaleDateString()}
                </div>
              </div>
            </button>
          ))}
          {conversations.filter((c) => c.type === "chat").length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", fontSize: 13 }}>暂无对话，点击上方按钮创建</div>
          )}
        </div>
      </div>
    );
  }

  // Chat view
  const messages = activeConv?.messages ?? [];
  const agent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      {/* Header */}
      <div style={{
        padding: "10px 12px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--bg-card)", flexShrink: 0,
      }}>
        <button onClick={() => setShowConvList(true)} style={{ padding: 4, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-secondary)" }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {activeConv?.title ?? "新对话"}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {agent ? `${agent.avatar} ${agent.name}` : "自由对话"}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 10px", paddingBottom: 8 }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{
            display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            marginBottom: 10,
          }}>
            <div style={{
              maxWidth: "85%", padding: "10px 14px", borderRadius: 16,
              background: msg.role === "user" ? "var(--primary)" : "var(--bg-card)",
              color: msg.role === "user" ? "#fff" : "var(--text-primary)",
              border: msg.role === "user" ? "none" : "1px solid var(--border)",
              fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {msg.imageData && (
                <img src={msg.imageData} alt="uploaded" style={{ maxWidth: "100%", borderRadius: 8, marginBottom: 6 }} />
              )}
              {msg.content}
              <div style={{ fontSize: 10, color: msg.role === "user" ? "rgba(255,255,255,.6)" : "var(--text-muted)", marginTop: 4, textAlign: "right" }}>
                {formatTime(msg.createdAt)}
              </div>
            </div>
          </div>
        ))}

        {/* Streaming content */}
        {streaming && streamContent && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
            <div style={{
              maxWidth: "85%", padding: "10px 14px", borderRadius: 16,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
              color: "var(--text-primary)",
            }}>
              {streamContent}
              <span style={{ animation: "pulse 1s infinite", color: "var(--primary)" }}>▊</span>
            </div>
          </div>
        )}

        {streaming && !streamContent && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
            <div style={{
              padding: "10px 14px", borderRadius: 16,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              fontSize: 13, color: "var(--text-muted)",
            }}>
              思考中...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "8px 10px", paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
        borderTop: "1px solid var(--border)", background: "var(--bg-card)", flexShrink: 0,
      }}>
        {/* Agent selector chips */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", marginBottom: 6, paddingBottom: 2 }}>
          <button onClick={() => setSelectedAgentId("")} style={{
            padding: "4px 10px", borderRadius: 12, border: "none", fontSize: 11, whiteSpace: "nowrap", cursor: "pointer",
            background: !selectedAgentId ? "var(--primary)" : "var(--bg-secondary)",
            color: !selectedAgentId ? "#fff" : "var(--text-secondary)",
          }}>自由</button>
          {agents.map((a) => (
            <button key={a.id} onClick={() => setSelectedAgentId(a.id)} style={{
              padding: "4px 10px", borderRadius: 12, border: "none", fontSize: 11, whiteSpace: "nowrap", cursor: "pointer",
              background: selectedAgentId === a.id ? "var(--primary)" : "var(--bg-secondary)",
              color: selectedAgentId === a.id ? "#fff" : "var(--text-secondary)",
            }}>{a.avatar} {a.name}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="输入消息..."
            rows={1}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 16, border: "1px solid var(--border)",
              background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 14,
              resize: "none", outline: "none", fontFamily: "inherit", lineHeight: 1.4,
              maxHeight: 100,
            }}
          />
          {streaming ? (
            <button onClick={() => { abortRef.current?.abort(); setStreaming(false); setStreamContent(""); }} style={{
              width: 40, height: 40, borderRadius: "50%", border: "none",
              background: "var(--primary)", color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><StopCircle size={18} /></button>
          ) : (
            <button onClick={sendMessage} disabled={!input.trim()} style={{
              width: 40, height: 40, borderRadius: "50%", border: "none",
              background: input.trim() ? "var(--primary)" : "var(--bg-active)",
              color: input.trim() ? "#fff" : "var(--text-muted)", cursor: input.trim() ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><Send size={18} /></button>
          )}
        </div>
      </div>
    </div>
  );
}
