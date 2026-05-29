import { useState } from "react";
import { Bot, Plus, Trash2, Volume2, ChevronDown, ChevronRight } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, getProviderIcon } from "../lib/shared";
import type { AgentConfig, AgentTTSConfig } from "../core/types";

export function MobileAgentsView() {
  const {
    agents, setAgents, providers, models, selectedProviderId, selectedModelId,
    agentModelConfigs, setAgentModelConfigs, agentTTSConfigs, setAgentTTSConfigs,
    ttsProviders, ttsPlaying, showToast,
  } = useStore();

  const ttsEnabledGlobal = useStore((s) => s.ttsEnabled);
  const setTtsEnabled = useStore((s) => s.setTtsEnabled);
  const setTtsPlaying = useStore((s) => s.setTtsPlaying);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AgentConfig["role"]>("coder");
  const [newPrompt, setNewPrompt] = useState("");
  const [newAvatar, setNewAvatar] = useState("✦");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const speakText = async (text: string, agentId?: string) => {
    const agentTTS = agentId ? agentTTSConfigs.find((c) => c.agentId === agentId) : undefined;
    if (!ttsEnabledGlobal && !agentTTS?.enabled) return;
    setTtsPlaying(true);
    try {
      const resp = await apiFetch("/api/tts", {
        method: "POST",
        body: JSON.stringify({
          text: text.slice(0, 2000), voice: agentTTS?.voice,
          stylePrompt: agentTTS?.stylePrompt, speed: agentTTS?.speed,
          format: "wav", agentId, ttsProviderId: agentTTS?.ttsProviderId,
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
      } else { setTtsPlaying(false); showToast("TTS 失败", "error"); }
    } catch { setTtsPlaying(false); }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const resp = await apiFetch("/api/agents", {
        method: "POST",
        body: JSON.stringify({
          name: newName, role: newRole, avatar: newAvatar,
          systemPrompt: newPrompt, goal: newPrompt.slice(0, 50),
        }),
      });
      if (resp.ok) {
        const a = (await resp.json()) as AgentConfig;
        setAgents((prev) => [...prev, a]);
        setShowCreate(false); setNewName(""); setNewPrompt(""); setNewAvatar("✦");
        showToast("Agent 已创建", "success");
      }
    } catch {}
  };

  const handleDelete = async (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
    try { await apiFetch(`/api/agents/${id}`, { method: "DELETE" }); } catch {}
  };

  const roleLabels: Record<string, string> = {
    coder: "编码", researcher: "研究", product: "产品", testing: "测试",
    documentation: "文档", moderator: "主持", architecture: "架构",
    ui: "UI设计", review: "审查",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Agent 管理</h2>
        <button onClick={() => setShowCreate(!showCreate)} style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "8px 12px", borderRadius: 8, border: "none",
          background: "var(--primary)", color: "#fff", fontSize: 13,
          fontWeight: 600, cursor: "pointer",
        }}>
          <Plus size={14} /> 创建
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {/* Create form */}
        {showCreate && (
          <div style={{
            padding: 14, marginBottom: 12, borderRadius: 12,
            border: "1px solid var(--border)", background: "var(--bg-card)",
          }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "var(--text-primary)" }}>创建自定义 Agent</h4>
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>名称</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Agent 名称" style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 60 }}>
                <label style={labelStyle}>Emoji</label>
                <input value={newAvatar} onChange={(e) => setNewAvatar(e.target.value)} style={{ ...inputStyle, textAlign: "center" }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>角色</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as AgentConfig["role"])} style={{ ...inputStyle, width: "100%" }}>
                  {Object.entries(roleLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>System Prompt</label>
              <textarea
                value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="定义 Agent 的行为和专长..."
                style={{ ...inputStyle, minHeight: 70, width: "100%", resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={handleCreate} style={btnStyle("var(--primary)")}>创建</button>
              <button onClick={() => setShowCreate(false)} style={btnStyle("var(--bg-secondary)")}>取消</button>
            </div>
          </div>
        )}

        {/* Agent list */}
        {agents.map((a) => {
          const agentCfg = agentModelConfigs.find((c) => c.agentId === a.id && !c.useGlobal);
          const globalProv = providers.find((p) => p.id === selectedProviderId);
          const globalModel = models.find((m) => m.id === selectedModelId);
          const effectiveModel = agentCfg?.modelId ?? (globalModel ? `${globalProv?.name ?? ""} / ${globalModel.id}` : "未设置");
          const isExpanded = expandedId === a.id;
          const agentTTS = agentTTSConfigs.find((c) => c.agentId === a.id);

          return (
            <div key={a.id} style={{
              marginBottom: 8, borderRadius: 12, border: "1px solid var(--border)",
              background: "var(--bg-card)", overflow: "hidden",
            }}>
              <button onClick={() => setExpandedId(isExpanded ? null : a.id)} style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "12px 14px", border: "none", background: "transparent",
                cursor: "pointer", textAlign: "left",
              }}>
                <span style={{ fontSize: 24 }}>{a.avatar}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {roleLabels[a.role] ?? a.role} · {effectiveModel}
                  </div>
                </div>
                {agentCfg && <span style={{ fontSize: 10, color: "var(--primary)", padding: "2px 6px", borderRadius: 4, background: "rgba(14,165,233,0.08)" }}>自定义模型</span>}
                {isExpanded ? <ChevronDown size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />}
              </button>

              {isExpanded && (
                <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--border)" }}>
                  {/* Model config */}
                  <div style={{ marginTop: 10, marginBottom: 10 }}>
                    <label style={labelStyle}>模型供应商</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        value={agentCfg?.providerId ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          const pm = models.filter((m) => m.providerId === v);
                          const nc = agentModelConfigs.map((c) =>
                            c.agentId === a.id ? { ...c, providerId: v, modelId: pm[0]?.id ?? "" } : c
                          );
                          if (agentCfg) {
                            setAgentModelConfigs(nc);
                            apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: nc }) });
                          } else {
                            const newCfg = { agentId: a.id, providerId: v, modelId: pm[0]?.id ?? "" };
                            const ncs = [...agentModelConfigs, newCfg];
                            setAgentModelConfigs(ncs);
                            apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: ncs }) });
                          }
                        }}
                        style={{ flex: 1, ...inputStyle }}
                      >
                        <option value="">全局 ({globalProv?.name ?? "未设置"})</option>
                        {providers.filter((p) => p.enabled).map((p) => (
                          <option key={p.id} value={p.id}>{getProviderIcon(p.type)} {p.name}</option>
                        ))}
                      </select>
                      <select
                        value={agentCfg?.modelId ?? ""}
                        onChange={(e) => {
                          if (agentCfg) {
                            const nc = agentModelConfigs.map((c) => c.agentId === a.id ? { ...c, modelId: e.target.value } : c);
                            setAgentModelConfigs(nc);
                            apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: nc }) });
                          }
                        }}
                        style={{ flex: 1, ...inputStyle }}
                      >
                        {!agentCfg ? (
                          <option value="">{effectiveModel}</option>
                        ) : (
                          models.filter((m) => m.providerId === agentCfg.providerId).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.id} {m.capabilities.reasoning ? "🧠" : ""}{m.capabilities.vision ? "👁" : ""}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* TTS config */}
                  {providers.some((p) => p.type === "xiaomi-mimo" && p.enabled && p.apiKey) && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <Volume2 size={14} style={{ color: "var(--text-muted)" }} />
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>语音设置</span>
                        <button onClick={() => {
                          const existing = agentTTSConfigs.find((c) => c.agentId === a.id);
                          const nc: AgentTTSConfig = {
                            agentId: a.id, enabled: !existing?.enabled,
                            ttsProviderId: existing?.ttsProviderId, voice: existing?.voice,
                            speed: existing?.speed, stylePrompt: existing?.stylePrompt,
                            autoSpeak: existing?.autoSpeak,
                          };
                          const ncs = [...agentTTSConfigs.filter((c) => c.agentId !== a.id), nc];
                          setAgentTTSConfigs(ncs);
                          apiFetch("/api/agent-tts-configs", { method: "PUT", body: JSON.stringify({ configs: ncs }) });
                          if (nc.enabled) setTtsEnabled(true);
                        }} style={{
                          width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
                          background: agentTTS?.enabled ? "var(--primary)" : "var(--bg-active)",
                          position: "relative", marginLeft: "auto",
                        }}>
                          <div style={{
                            width: 16, height: 16, borderRadius: "50%", background: "#fff",
                            position: "absolute", top: 2, left: agentTTS?.enabled ? 18 : 2,
                            transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                          }} />
                        </button>
                      </div>

                      {agentTTS?.enabled && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <select value={agentTTS.voice ?? "mimo_default"} onChange={(e) => {
                              const ncs = agentTTSConfigs.map((c) => c.agentId === a.id ? { ...c, voice: e.target.value } : c);
                              setAgentTTSConfigs(ncs);
                              apiFetch("/api/agent-tts-configs", { method: "PUT", body: JSON.stringify({ configs: ncs }) });
                            }} style={{ flex: 1, ...inputStyle }}>
                              <option value="mimo_default">默认</option>
                              <option value="冰糖">冰糖 ♀</option>
                              <option value="茉莉">茉莉 ♀</option>
                              <option value="苏打">苏打 ♂</option>
                              <option value="白桦">白桦 ♂</option>
                              <option value="Mia">Mia EN</option>
                            </select>
                            <select value={agentTTS.speed ?? 1.0} onChange={(e) => {
                              const ncs = agentTTSConfigs.map((c) => c.agentId === a.id ? { ...c, speed: parseFloat(e.target.value) } : c);
                              setAgentTTSConfigs(ncs);
                              apiFetch("/api/agent-tts-configs", { method: "PUT", body: JSON.stringify({ configs: ncs }) });
                            }} style={{ width: 70, ...inputStyle }}>
                              <option value="0.5">0.5x</option>
                              <option value="0.75">0.75x</option>
                              <option value="1.0">1.0x</option>
                              <option value="1.25">1.25x</option>
                              <option value="1.5">1.5x</option>
                              <option value="2.0">2.0x</option>
                            </select>
                          </div>
                          <input
                            placeholder="风格: 温柔/活泼/严肃..."
                            value={agentTTS.stylePrompt ?? ""}
                            onChange={(e) => {
                              const ncs = agentTTSConfigs.map((c) => c.agentId === a.id ? { ...c, stylePrompt: e.target.value } : c);
                              setAgentTTSConfigs(ncs);
                            }}
                            onBlur={() => apiFetch("/api/agent-tts-configs", { method: "PUT", body: JSON.stringify({ configs: agentTTSConfigs }) })}
                            style={inputStyle}
                          />
                          <button onClick={() => speakText("你好，很高兴认识你！", a.id)} disabled={ttsPlaying} style={{
                            ...btnStyle("var(--bg-card)"), alignSelf: "flex-start",
                          }}>
                            {ttsPlaying ? "⏳" : "🔊"} 试听
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Delete */}
                  <button onClick={() => handleDelete(a.id)} style={{
                    ...btnStyle("transparent"),
                    color: "var(--accent, #f43f5e)", border: "1px solid var(--border)",
                    width: "100%", justifyContent: "center",
                  }}>
                    <Trash2 size={13} /> 删除 Agent
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)", fontSize: 13,
  outline: "none", fontFamily: "inherit",
};

const btnStyle = (bg: string): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 4,
  padding: "8px 14px", borderRadius: 8,
  border: "1px solid var(--border)", background: bg,
  color: bg === "var(--primary)" ? "#fff" : "var(--text-primary)",
  cursor: "pointer", fontSize: 12,
});
