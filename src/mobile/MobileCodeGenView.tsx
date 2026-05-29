import { useState } from "react";
import { Code2, Loader2, Play, Sparkles } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch } from "../lib/shared";

const PHASES = ["requirements", "design", "generation", "testing", "documentation", "review"] as const;
const PHASE_NAMES: Record<string, string> = {
  requirements: "需求", design: "设计", generation: "生成",
  testing: "测试", documentation: "文档", review: "审查",
};

const TEMPLATES = [
  { name: "AI 简历优化", idea: "帮我做一个 AI 简历优化 Web 应用", icon: "📄" },
  { name: "聊天应用", idea: "帮我做一个实时聊天 Web 应用", icon: "💬" },
  { name: "数据面板", idea: "帮我做一个数据可视化面板", icon: "📊" },
];

export function MobileCodeGenView() {
  const { getEffectiveConfig, showToast } = useStore();
  const [idea, setIdea] = useState("");
  const [stack, setStack] = useState("Vite + React + TypeScript");
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<Array<{ phase: string; content: string; agentName: string }>>([]);
  const [phase, setPhase] = useState("");

  const start = async () => {
    if (!idea.trim() || streaming) return;
    setStreaming(true);
    setMessages([]);
    const cfg = getEffectiveConfig("agent-moderator");
    try {
      const resp = await apiFetch("/api/codegen", {
        method: "POST",
        body: JSON.stringify({ idea, techStack: stack, providerId: cfg.providerId, model: cfg.modelId }),
      });
      if (!resp.ok) throw new Error("Failed");
      const reader = resp.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
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
    } catch {
      showToast("代码生成失败", "error");
    }
    setStreaming(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Code2 size={18} /> 代码生成
        </h2>
      </div>

      {/* Input area */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
        <textarea
          value={idea} onChange={(e) => setIdea(e.target.value)}
          placeholder="描述你的应用想法..."
          style={{
            width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border)",
            background: "var(--bg-secondary)", color: "var(--text-primary)",
            fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", minHeight: 60,
          }}
        />
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <select value={stack} onChange={(e) => setStack(e.target.value)} style={{
            flex: 1, padding: "8px 10px", borderRadius: 8,
            border: "1px solid var(--border)", background: "var(--bg-secondary)",
            fontSize: 12, outline: "none",
          }}>
            <option>Vite + React + TypeScript</option>
            <option>Next.js + TypeScript</option>
            <option>Express + Node.js</option>
            <option>Python + FastAPI</option>
          </select>
          <button onClick={start} disabled={streaming || !idea.trim()} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "8px 16px", borderRadius: 8, border: "none",
            background: idea.trim() && !streaming ? "var(--primary)" : "var(--bg-active)",
            color: idea.trim() && !streaming ? "#fff" : "var(--text-muted)",
            cursor: idea.trim() && !streaming ? "pointer" : "default",
            fontSize: 13, fontWeight: 600,
          }}>
            {streaming ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
            {streaming ? "生成中" : "开始"}
          </button>
        </div>

        {/* Quick templates */}
        <div style={{ display: "flex", gap: 6, marginTop: 8, overflowX: "auto" }}>
          {TEMPLATES.map((t) => (
            <button key={t.name} onClick={() => setIdea(t.idea)} style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--bg-card)", color: "var(--text-secondary)",
              fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {t.icon} {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Phase progress */}
      {streaming || phase ? (
        <div style={{
          padding: "8px 16px", display: "flex", gap: 4, overflowX: "auto",
          borderBottom: "1px solid var(--border)", background: "var(--bg-card)",
        }}>
          {PHASES.map((p) => {
            const isActive = phase === p;
            const isDone = PHASES.indexOf(p) < PHASES.indexOf(phase as typeof PHASES[number]);
            return (
              <div key={p} style={{
                display: "flex", alignItems: "center", gap: 3,
                padding: "3px 8px", borderRadius: 6, fontSize: 11, whiteSpace: "nowrap",
                background: isActive ? "var(--primary)" : isDone ? "rgba(16,185,129,0.1)" : "var(--bg-secondary)",
                color: isActive ? "#fff" : isDone ? "#10b981" : "var(--text-muted)",
              }}>
                {isDone ? "✓" : isActive ? <Loader2 size={11} className="spin" /> : "○"}
                {PHASE_NAMES[p]}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "10px 16px" }}>
        {messages.length === 0 && !streaming && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <Sparkles size={40} style={{ color: "var(--primary)", marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>AI 代码生成</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              描述你的应用想法，AI 团队会帮你从需求到代码全流程生成
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: "#6BCB77",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, flexShrink: 0,
            }}>💻</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6BCB77", marginBottom: 3 }}>
                {msg.agentName || PHASE_NAMES[msg.phase] || msg.phase}
              </div>
              <div style={{
                padding: "8px 12px", borderRadius: 12,
                background: "var(--bg-card)", border: "1px solid var(--border)",
                fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
                wordBreak: "break-word", color: "var(--text-primary)",
              }}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
