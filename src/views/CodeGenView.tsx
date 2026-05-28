import { useState } from "react";
import { Code2, Loader2, Play } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch } from "../lib/shared";
import { projectTemplates } from "../core/demoData";

export function CodeGenView() {
  const { getEffectiveConfig } = useStore();
  const [idea, setIdea] = useState("");
  const [stack, setStack] = useState("Vite + React + TypeScript");
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<Array<{ phase: string; content: string; agentName: string }>>([]);
  const [phase, setPhase] = useState("");

  const phases = ["requirements", "design", "generation", "testing", "documentation", "review"] as const;
  const phaseNames: Record<string, string> = { requirements: "需求", design: "设计", generation: "生成", testing: "测试", documentation: "文档", review: "审查" };

  const start = async () => {
    if (!idea.trim() || streaming) return;
    setStreaming(true); setMessages([]);
    const cfg = getEffectiveConfig("agent-moderator");
    try {
      const resp = await apiFetch("/api/codegen", { method: "POST", body: JSON.stringify({ idea, techStack: stack, providerId: cfg.providerId, model: cfg.modelId }) });
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
              if (evt === "phase") setPhase(d.phase);
              else if (evt === "message") setMessages((p) => [...p, d]);
            } catch {}
          }
        }
      }
    } catch { /* ignore */ }
    setStreaming(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Code2 size={16} /> 代码生成</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input placeholder="描述你的应用想法..." value={idea} onChange={(e) => setIdea(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)" }} />
          <select value={stack} onChange={(e) => setStack(e.target.value)} style={{ padding: "8px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}>
            <option>Vite + React + TypeScript</option><option>Next.js + TypeScript</option><option>Express + Node.js</option><option>Python + FastAPI</option>
          </select>
          <button className="primary" onClick={start} disabled={streaming || !idea.trim()}>
            {streaming ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
          </button>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {phases.map((p) => {
            const isActive = phase === p;
            const isDone = phases.indexOf(p) < phases.indexOf(phase as typeof phases[number]);
            return <div key={p} className={`phase-step ${isActive ? "running" : isDone ? "completed" : "pending"}`}><div className="phase-icon">{isDone ? "✓" : isActive ? <Loader2 size={12} className="spin" /> : "○"}</div><span>{phaseNames[p]}</span></div>;
          })}
        </div>
      </div>
      <div className="chat-messages" style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {messages.length === 0 && !streaming && (
          <div className="empty-state">
            <div className="empty-icon">⚡</div>
            <div className="empty-text">代码生成</div>
            <div className="empty-hint">描述你的应用想法，AI 团队会帮你从需求到代码全流程生成</div>
            <div className="quick-actions" style={{ marginTop: 16 }}>
              {projectTemplates.slice(0, 3).map((t) => <button key={t.id} className="quick-action-btn" onClick={() => setIdea(t.idea)}>{t.icon} {t.name}</button>)}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
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
      </div>
    </div>
  );
}
