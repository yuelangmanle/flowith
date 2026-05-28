import { useState, useRef, useEffect } from "react";
import { Loader2, Send, Users } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, uid } from "../lib/shared";

export function RoundtableView() {
  const { agents, getEffectiveConfig, createConversation } = useStore();
  const [topic, setTopic] = useState("");
  const [rtAgents, setRtAgents] = useState<string[]>(["agent-moderator", "agent-product", "agent-architecture", "agent-critic"]);
  const [rounds, setRounds] = useState(3);
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<Array<{ agentId: string; agentName: string; agentColor: string; agentAvatar: string; content: string; round: number }>>([]);
  const [report, setReport] = useState<StructuredReport | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  type StructuredReport = { title: string; sections: Array<{ heading: string; content: string }>; conclusion: string };

  const start = async () => {
    if (!topic.trim() || streaming) return;
    setStreaming(true); setMessages([]); setReport(null);
    createConversation("roundtable", `圆桌: ${topic.slice(0, 20)}`);
    const cfg = getEffectiveConfig("agent-moderator");
    try {
      const resp = await apiFetch("/api/roundtable", { method: "POST", body: JSON.stringify({ topic, agentIds: rtAgents, rounds, providerId: cfg.providerId, model: cfg.modelId }) });
      if (!resp.ok) throw new Error("Failed");
      const reader = resp.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        let evt = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { evt = line.slice(7).trim(); continue; }
          if (line.startsWith("data: ")) {
            try {
              const d = JSON.parse(line.slice(6));
              if (evt === "message") setMessages((p) => [...p, d]);
              else if (evt === "report") setReport(d);
            } catch {}
          }
        }
      }
    } catch { /* ignore */ }
    setStreaming(false);
  };

  return (
    <div className="roundtable-container" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Users size={16} /> 圆桌会议</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input placeholder="输入讨论话题..." value={topic} onChange={(e) => setTopic(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
          <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))} style={{ padding: "8px", borderRadius: 8, border: "1px solid var(--border)", width: 80 }}>
            <option value={2}>2轮</option><option value={3}>3轮</option><option value={5}>5轮</option>
          </select>
          <button className="primary" onClick={start} disabled={streaming || !topic.trim()}>
            {streaming ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          </button>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {agents.map((a) => (
            <button key={a.id} className={`agent-chip ${rtAgents.includes(a.id) ? "selected" : ""}`} onClick={() => setRtAgents((p) => p.includes(a.id) ? p.filter((id) => id !== a.id) : [...p, a.id])} style={{ fontSize: 11, padding: "3px 8px" }}>
              {a.avatar} {a.name}
            </button>
          ))}
        </div>
      </div>
      <div className="chat-messages" style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {messages.map((msg, i) => (
          <div key={i} className="msg-row assistant">
            <div className="msg-avatar" style={{ background: msg.agentColor }}>{msg.agentAvatar}</div>
            <div>
              <div className="msg-bubble">
                <div className="msg-agent-name" style={{ color: msg.agentColor }}>{msg.agentAvatar} {msg.agentName} <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 400 }}>第{msg.round + 1}轮</span></div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{msg.content}</div>
              </div>
            </div>
          </div>
        ))}
        {report && (
          <div style={{ padding: 16, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", marginTop: 12 }}>
            <h4 style={{ marginBottom: 8 }}>{report.title}</h4>
            {report.sections.map((s, i) => <div key={i} style={{ marginBottom: 8 }}><strong>{s.heading}</strong><p style={{ marginTop: 4, fontSize: 13 }}>{s.content}</p></div>)}
            <p style={{ fontWeight: 500 }}>{report.conclusion}</p>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
