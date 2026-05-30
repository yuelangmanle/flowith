import { useRef, useEffect } from "react";
import { Loader2, Send, Users } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch } from "../lib/shared";

export function RoundtableView() {
  const { agents, getEffectiveConfig, createConversation } = useStore();
  const rtState = useStore((s) => s.rtState);
  const setRtState = useStore((s) => s.setRtState);
  const rtAbortController = useStore((s) => s.rtAbortController);
  const setRtAbortController = useStore((s) => s.setRtAbortController);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView?.({ behavior: "smooth" }); }, [rtState.messages]);

  const start = async () => {
    if (!rtState.topic.trim() || rtState.streaming) return;
    setRtState({ streaming: true, messages: [], report: null });
    createConversation("roundtable", `圆桌: ${rtState.topic.slice(0, 20)}`);
    const cfg = getEffectiveConfig("agent-moderator");
    const controller = new AbortController();
    setRtAbortController(controller);
    try {
      const resp = await apiFetch("/api/roundtable", {
        method: "POST",
        body: JSON.stringify({ topic: rtState.topic, agentIds: rtState.rtAgents, rounds: rtState.rounds, providerId: cfg.providerId, model: cfg.modelId }),
        signal: controller.signal,
      });
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
              if (evt === "message") setRtState({ messages: [...useStore.getState().rtState.messages, d] });
              else if (evt === "report") setRtState({ report: d });
            } catch {}
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    setRtState({ streaming: false });
    setRtAbortController(null);
  };

  const stop = () => {
    rtAbortController?.abort();
    setRtState({ streaming: false });
    setRtAbortController(null);
  };

  return (
    <div className="roundtable-container" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Users size={16} /> 圆桌会议</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input placeholder="输入讨论话题..." value={rtState.topic} onChange={(e) => setRtState({ topic: e.target.value })} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
          <select value={rtState.rounds} onChange={(e) => setRtState({ rounds: Number(e.target.value) })} style={{ padding: "8px", borderRadius: 8, border: "1px solid var(--border)", width: 80 }}>
            <option value={2}>2轮</option><option value={3}>3轮</option><option value={5}>5轮</option>
          </select>
          {rtState.streaming ? (
            <button className="primary" onClick={stop} style={{ background: "var(--accent, #f43f5e)" }}>
              <Loader2 size={16} className="spin" /> 停止
            </button>
          ) : (
            <button className="primary" onClick={start} disabled={!rtState.topic.trim()}>
              <Send size={16} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {agents.map((a) => (
            <button key={a.id} className={`agent-chip ${rtState.rtAgents.includes(a.id) ? "selected" : ""}`} onClick={() => setRtState({ rtAgents: rtState.rtAgents.includes(a.id) ? rtState.rtAgents.filter((id) => id !== a.id) : [...rtState.rtAgents, a.id] })} style={{ fontSize: 11, padding: "3px 8px" }}>
              {a.avatar} {a.name}
            </button>
          ))}
        </div>
      </div>
      <div className="chat-messages" style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {rtState.messages.length === 0 && !rtState.streaming && (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            <Users size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div style={{ fontSize: 14 }}>输入话题，开始圆桌讨论</div>
          </div>
        )}
        {rtState.messages.map((msg, i) => (
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
        {rtState.report && (
          <div style={{ padding: 16, background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border)", marginTop: 12 }}>
            <h4 style={{ marginBottom: 8 }}>{rtState.report.title}</h4>
            {rtState.report.sections.map((s, i) => <div key={i} style={{ marginBottom: 8 }}><strong>{s.heading}</strong><p style={{ marginTop: 4, fontSize: 13 }}>{s.content}</p></div>)}
            <p style={{ fontWeight: 500 }}>{rtState.report.conclusion}</p>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
