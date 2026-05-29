import { useState, useRef, useEffect, useCallback } from "react";
import { Send, StopCircle, Users } from "lucide-react";
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
  isReport?: boolean;
}

export function MobileRoundtableView() {
  const store = useStore();
  const { agents, providers, showToast, createConversation, setActiveConvId } = store;

  const [topic, setTopic] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [rounds, setRounds] = useState(3);
  const [running, setRunning] = useState(false);
  const [messages, setMessages] = useState<RoundtableMsg[]>([]);
  const [report, setReport] = useState<string>("");
  const [showSetup, setShowSetup] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages.length, scrollToBottom]);

  const toggleAgent = (id: string) => {
    setSelectedAgents((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
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

    try {
      const resp = await apiFetch("/api/roundtable", {
        method: "POST",
        body: JSON.stringify({ topic: topic.trim(), agentIds: selectedAgents, rounds, providerId: provider.id }),
      });

      const reader = resp.body?.getReader();
      if (!reader) { setRunning(false); return; }

      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) { eventType = line.slice(7).trim(); continue; }
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
                    id: uid(), agentId: data.agentId, agentName: agent?.name ?? data.agentId,
                    agentColor: agent?.color, avatar: agent?.avatar, content: data.content, createdAt: new Date().toISOString(),
                  }];
                });
              } else if (eventType === "report") {
                setReport(typeof data === "string" ? data : data.content ?? JSON.stringify(data));
              } else if (eventType === "done") {
                setRunning(false);
                if (data.conversationId) {
                  const conv = createConversation("roundtable", `圆桌: ${topic.slice(0, 20)}`);
                  setActiveConvId(conv.id);
                }
              } else if (eventType === "error") {
                showToast(`错误: ${data.error}`, "error");
                setRunning(false);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      showToast(`请求失败: ${err instanceof Error ? err.message : "未知错误"}`, "error");
    }
    setRunning(false);
  };

  // Setup view
  if (showSetup) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>圆桌讨论</h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>多个 AI 辩论投票，生成结构化报告</p>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, display: "block" }}>讨论话题</label>
            <textarea
              value={topic} onChange={(e) => setTopic(e.target.value)}
              placeholder="输入要讨论的话题..."
              style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 14, resize: "none", outline: "none", fontFamily: "inherit", minHeight: 80 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, display: "block" }}>选择 Agent（至少 2 个）</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {agents.map((a) => (
                <button key={a.id} onClick={() => toggleAgent(a.id)} style={{
                  padding: "8px 14px", borderRadius: 12, fontSize: 13, cursor: "pointer",
                  background: selectedAgents.includes(a.id) ? "var(--primary)" : "var(--bg-card)",
                  color: selectedAgents.includes(a.id) ? "#fff" : "var(--text-primary)",
                  border: selectedAgents.includes(a.id) ? "2px solid var(--primary)" : "1px solid var(--border)",
                }}>{a.avatar} {a.name}</button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6, display: "block" }}>讨论轮数: {rounds}</label>
            <input type="range" min={1} max={5} value={rounds} onChange={(e) => setRounds(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
          <button onClick={startRoundtable} disabled={!topic.trim() || selectedAgents.length < 2} style={{
            width: "100%", padding: 14, borderRadius: 12, border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer",
            background: (topic.trim() && selectedAgents.length >= 2) ? "var(--primary)" : "var(--bg-active)",
            color: (topic.trim() && selectedAgents.length >= 2) ? "#fff" : "var(--text-muted)",
          }}>开始讨论</button>
        </div>
      </div>
    );
  }

  // Discussion view
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-card)", flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>圆桌: {topic}</div>
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{running ? "讨论中..." : "讨论结束"}</div>
        </div>
        <button onClick={() => { setShowSetup(true); setMessages([]); setReport(""); }} style={{
          padding: "6px 12px", borderRadius: 8, border: "none", background: "var(--bg-secondary)", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer",
        }}>新话题</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "10px" }}>
        {messages.map((msg) => (
          <div key={msg.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: msg.agentColor ?? "var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0,
            }}>{msg.avatar ?? "?"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{msg.agentName}</div>
              <div style={{
                padding: "8px 12px", borderRadius: 12, background: "var(--bg-card)",
                border: "1px solid var(--border)", fontSize: 13, lineHeight: 1.6,
                whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text-primary)",
              }}>{msg.content}</div>
            </div>
          </div>
        ))}

        {report && (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--primary)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--primary)", marginBottom: 8 }}>结构化报告</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", color: "var(--text-primary)" }}>{report}</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
