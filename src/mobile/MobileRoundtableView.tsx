import { useState, useRef, useEffect, useCallback } from "react";
import { Send, StopCircle, Users, Download, ChevronLeft } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, uid, formatTime } from "../lib/shared";

interface RoundtableMsg {
  id: string;
  agentId?: string;
  agentName?: string;
  agentColor?: string;
  avatar?: string;
  content: string;
  createdAt: string;
  round?: number;
  isReport?: boolean;
}

export function MobileRoundtableView() {
  const store = useStore();
  const { agents, providers, models, showToast, createConversation, setActiveConvId } = store;

  const [topic, setTopic] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [rounds, setRounds] = useState(3);
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<RoundtableMsg[]>([]);
  const [report, setReport] = useState<string>("");
  const [showSetup, setShowSetup] = useState(true);
  const [selectedModelId, setSelectedModelId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages.length, scrollToBottom]);

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const startRoundtable = async () => {
    if (!topic.trim() || selectedAgents.length < 2) {
      showToast("请输入话题并选择至少 2 个 Agent", "error");
      return;
    }

    const provider = providers.find((p) => p.enabled && (p.apiKey || p.type === "ollama"));
    if (!provider) { showToast("请先配置 API 密钥", "error"); return; }

    setRunning(true);
    setMessages([]);
    setReport("");
    setShowSetup(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await apiFetch("/api/roundtable", {
        method: "POST",
        body: JSON.stringify({
          topic: topic.trim(), agentIds: selectedAgents, rounds,
          providerId: provider.id,
          model: selectedModelId || undefined,
        }),
        signal: controller.signal,
      });

      // Check for API errors before parsing SSE
      if (!resp.ok) {
        let errMsg = `API 错误 ${resp.status}`;
        try {
          const errData = await resp.json() as { error?: string };
          errMsg = errData.error ?? errMsg;
        } catch {}
        showToast(errMsg, "error");
        setRunning(false);
        return;
      }

      // Parse SSE response - handle both streaming and buffered responses
      let eventType = "";

      const processSSELine = (line: string) => {
        if (line.startsWith("event: ")) { eventType = line.slice(7).trim(); return; }
        if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "text" && data.content) {
                const agent = agents.find((a) => a.id === data.agentId);
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last && last.agentId === data.agentId && !last.isReport) {
                    return [...prev.slice(0, -1), { ...last, content: last.content + data.content }];
                  }
                  return [...prev, {
                    id: uid(), agentId: data.agentId,
                    agentName: agent?.name ?? data.agentId,
                    agentColor: agent?.color, avatar: agent?.avatar,
                    content: data.content, createdAt: new Date().toISOString(),
                    round: data.round,
                  }];
                });
              } else if (eventType === "report") {
                setReport(typeof data === "string" ? data : data.content ?? JSON.stringify(data));
              } else if (eventType === "done") {
                setRunning(false);
                if (data.conversationId) {
                  setActiveConvId(data.conversationId);
                }
              } else if (eventType === "error") {
                showToast(`错误: ${data.error}`, "error");
                setRunning(false);
              }
            } catch {}
        }
      };

      const reader = resp.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";
          parts.forEach(processSSELine);
        }
        if (buffer.trim()) processSSELine(buffer);
      } else {
        const text = await resp.text();
        text.split("\n").forEach(processSSELine);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        showToast("已停止讨论", "info");
      } else {
        showToast(`请求失败: ${err instanceof Error ? err.message : "未知错误"}`, "error");
      }
    }
    setRunning(false);
    abortRef.current = null;
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const handleExportReport = () => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roundtable-${topic.slice(0, 20)}-report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Setup view ──────────────────────────────────────────────

  if (showSetup) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            <Users size={18} style={{ verticalAlign: "text-bottom", marginRight: 6 }} />
            圆桌讨论
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            多个 AI 辩论投票，生成结构化报告
          </p>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {/* Topic */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>讨论话题</label>
            <textarea
              value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="输入要讨论的话题..."
              style={{
                width: "100%", padding: 12, borderRadius: 12,
                border: "1px solid var(--border)", background: "var(--bg-card)",
                color: "var(--text-primary)", fontSize: 14,
                resize: "none", outline: "none", fontFamily: "inherit", minHeight: 80,
              }}
            />
          </div>

          {/* Agent selection */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>选择 Agent（至少 2 个）</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {agents.map((a) => (
                <button key={a.id} onClick={() => toggleAgent(a.id)} style={{
                  padding: "8px 14px", borderRadius: 12, fontSize: 13,
                  cursor: "pointer",
                  background: selectedAgents.includes(a.id) ? "var(--primary)" : "var(--bg-card)",
                  color: selectedAgents.includes(a.id) ? "#fff" : "var(--text-primary)",
                  border: selectedAgents.includes(a.id) ? "2px solid var(--primary)" : "1px solid var(--border)",
                  fontWeight: selectedAgents.includes(a.id) ? 600 : 400,
                }}>
                  {a.avatar} {a.name}
                </button>
              ))}
            </div>
          </div>

          {/* Model selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>模型</label>
            <input
              list="roundtable-models"
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              placeholder="自动选择"
              style={{
                width: "100%", padding: "8px 12px", borderRadius: 8,
                border: "1px solid var(--border)", background: "var(--bg-card)",
                fontSize: 13, color: "var(--text-primary)",
              }}
            />
            <datalist id="roundtable-models">
              {models.filter((m) => {
                const p = providers.find((pp) => pp.id === m.providerId);
                return p?.enabled;
              }).map((m) => <option key={m.id} value={m.id} />)}
            </datalist>
          </div>

          {/* Rounds */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>讨论轮数: {rounds}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="range" min={1} max={5} value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", width: 20, textAlign: "center" }}>{rounds}</span>
            </div>
          </div>
        </div>

        <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
          <button onClick={startRoundtable} disabled={!topic.trim() || selectedAgents.length < 2} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none",
            fontSize: 15, fontWeight: 600, cursor: "pointer",
            background: (topic.trim() && selectedAgents.length >= 2) ? "var(--primary)" : "var(--bg-active)",
            color: (topic.trim() && selectedAgents.length >= 2) ? "#fff" : "var(--text-muted)",
          }}>
            开始讨论
          </button>
        </div>
      </div>
    );
  }

  // ─── Discussion view ─────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      {/* Header */}
      <div style={{
        padding: "10px 16px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--bg-card)", flexShrink: 0,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => { setShowSetup(true); setMessages([]); setReport(""); if (running) handleStop(); }} style={{
              border: "none", background: "transparent", cursor: "pointer",
              color: "var(--text-primary)", padding: 4, display: "flex",
            }}><ChevronLeft size={18} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 600, color: "var(--text-primary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                圆桌: {topic}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {running ? "讨论中..." : report ? "讨论结束" : "等待中..."}
                {messages.length > 0 && ` · ${messages.length} 条发言`}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {running && (
            <button onClick={handleStop} style={{
              padding: "6px 12px", borderRadius: 8, border: "none",
              background: "var(--accent, #f43f5e)", color: "#fff", fontSize: 12,
              cursor: "pointer",
            }}>停止</button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "10px" }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: msg.agentColor ?? "var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, flexShrink: 0,
            }}>
              {msg.avatar ?? "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: msg.agentColor || "var(--text-primary)",
                marginBottom: 3, display: "flex", alignItems: "center", gap: 6,
              }}>
                {msg.agentName}
                {msg.round !== undefined && (
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>
                    第{msg.round + 1}轮
                  </span>
                )}
              </div>
              <div style={{
                padding: "8px 12px", borderRadius: 12,
                background: "var(--bg-card)", border: "1px solid var(--border)",
                fontSize: 13, lineHeight: 1.6,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                color: "var(--text-primary)",
              }}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {/* Report */}
        {report && (
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 12,
            background: "var(--bg-card)", border: "1px solid var(--primary)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--primary)" }}>📋 结构化报告</div>
              <button onClick={handleExportReport} style={{
                padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)",
                background: "var(--bg-secondary)", color: "var(--text-secondary)",
                fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
              }}>
                <Download size={12} /> 导出
              </button>
            </div>
            <div style={{
              fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap",
              color: "var(--text-primary)",
            }}>
              {report}
            </div>
          </div>
        )}

        {/* Running indicator */}
        {running && !messages.some((m) => !m.isReport) && (
          <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", fontSize: 13 }}>
            <div style={{ animation: "pulse 1.5s infinite" }}>Agent 们正在思考...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
  marginBottom: 6, display: "block",
};
