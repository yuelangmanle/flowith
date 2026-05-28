import { useState } from "react";
import { Bot, Plus, Trash2, Volume2 } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, getProviderIcon } from "../lib/shared";
import type { AgentConfig, AgentTTSConfig } from "../core/types";

export function AgentsView() {
  const { agents, setAgents, providers, models, agentModelConfigs, setAgentModelConfigs, agentTTSConfigs, setAgentTTSConfigs, ttsPlaying, showToast } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AgentConfig["role"]>("coder");
  const [newPrompt, setNewPrompt] = useState("");
  const [newAvatar, setNewAvatar] = useState("🤖");

  const ttsEnabledGlobal = useStore((s) => s.ttsEnabled);
  const setTtsEnabled = useStore((s) => s.setTtsEnabled);
  const setTtsPlaying = useStore((s) => s.setTtsPlaying);

  const speakText = async (text: string, agentId?: string) => {
    const agentTTS = agentId ? agentTTSConfigs.find((c) => c.agentId === agentId) : undefined;
    if (!ttsEnabledGlobal && !agentTTS?.enabled) return;
    setTtsPlaying(true);
    try {
      const resp = await apiFetch("/api/tts", { method: "POST", body: JSON.stringify({ text: text.slice(0, 2000), voice: agentTTS?.voice ?? "mimo_default", stylePrompt: agentTTS?.stylePrompt, speed: agentTTS?.speed, format: "wav", agentId }) });
      if (resp.ok) {
        const data = await resp.json() as { audioBase64: string; format: string };
        const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
        const audio = new Audio(url);
        audio.onended = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
        await audio.play();
      } else { setTtsPlaying(false); showToast("TTS 失败", "error"); }
    } catch { setTtsPlaying(false); }
  };

  return (
    <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Bot size={18} /> Agent 管理</h3>
        <button className="primary" onClick={() => setShowCreate(!showCreate)}><Plus size={14} /> 创建 Agent</button>
      </div>
      {showCreate && (
        <div className="provider-card" style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 10 }}>创建自定义 Agent</h4>
          <div className="p-fields">
            <div className="field-row"><label>名称</label><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Agent 名称" /></div>
            <div className="field-row"><label>Emoji</label><input value={newAvatar} onChange={(e) => setNewAvatar(e.target.value)} style={{ width: 50, textAlign: "center" }} /></div>
            <div className="field-row"><label>角色</label><select value={newRole} onChange={(e) => setNewRole(e.target.value as AgentConfig["role"])} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
              <option value="coder">编码</option><option value="researcher">研究</option><option value="product">产品</option><option value="testing">测试</option><option value="documentation">文档</option>
            </select></div>
            <div className="field-row"><label>System Prompt</label><textarea value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder="定义 Agent 的行为..." style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", minHeight: 60, fontFamily: "var(--font)", fontSize: 13 }} /></div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="primary" onClick={async () => {
                if (!newName.trim()) return;
                const resp = await apiFetch("/api/agents", { method: "POST", body: JSON.stringify({ name: newName, role: newRole, avatar: newAvatar, systemPrompt: newPrompt, goal: newPrompt.slice(0, 50) }) });
                if (resp.ok) { const a = await resp.json() as AgentConfig; setAgents((prev) => [...prev, a]); setShowCreate(false); setNewName(""); setNewPrompt(""); setNewAvatar("🤖"); }
              }}>创建</button>
              <button onClick={() => setShowCreate(false)}>取消</button>
            </div>
          </div>
        </div>
      )}
      {agents.map((a) => {
        const agentCfg = agentModelConfigs.find((c) => c.agentId === a.id && !c.useGlobal);
        const effectiveModel = agentCfg?.modelId ?? "全局默认";
        return (
          <div key={a.id} className="agent-card" style={{ marginBottom: 6, flexDirection: "column", alignItems: "stretch" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="a-avatar" style={{ background: a.color }}>{a.avatar}</div>
              <div className="a-info">
                <div className="a-name">{a.name} {a.custom && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>(自定义)</span>}</div>
                <div className="a-role">{a.role}</div>
                <div className="a-goal">{a.goal || a.systemPrompt?.slice(0, 60)}</div>
              </div>
              {a.custom && <button className="icon-btn" onClick={async () => { await apiFetch(`/api/agents/${a.id}`, { method: "DELETE" }); setAgents((prev) => prev.filter((aa) => aa.id !== a.id)); }}><Trash2 size={14} /></button>}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 50 }}>模型:</span>
              <select value={agentCfg?.providerId ?? ""} onChange={(e) => {
                const v = e.target.value;
                if (!v) { const nc = agentModelConfigs.filter((c) => c.agentId !== a.id); setAgentModelConfigs(nc); apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: nc }) }); }
                else { const pm = models.filter((m) => m.providerId === v); const nc = [...agentModelConfigs.filter((c) => c.agentId !== a.id), { agentId: a.id, providerId: v, modelId: pm[0]?.id ?? "" }]; setAgentModelConfigs(nc); apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: nc }) }); }
              }} style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 11, background: "var(--bg-card)", maxWidth: 100 }}>
                <option value="">全局</option>
                {providers.filter((p) => p.enabled).map((p) => <option key={p.id} value={p.id}>{getProviderIcon(p.type)} {p.name}</option>)}
              </select>
              <select value={agentCfg?.modelId ?? ""} onChange={(e) => {
                const nc = agentModelConfigs.map((c) => c.agentId === a.id ? { ...c, modelId: e.target.value } : c);
                setAgentModelConfigs(nc);
                apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: nc }) });
              }} style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid var(--border)", fontSize: 11, background: "var(--bg-card)", maxWidth: 200 }}>
                {!agentCfg && <option value="">{effectiveModel}</option>}
                {agentCfg && models.filter((m) => m.providerId === agentCfg.providerId).map((m) => <option key={m.id} value={m.id}>{m.id} {m.capabilities.reasoning ? "🧠" : ""}{m.capabilities.fast ? "⚡" : ""}{m.capabilities.vision ? "👁" : ""}</option>)}
              </select>
              {agentCfg && <span style={{ fontSize: 10, color: "var(--primary)" }}>✓ 自定义</span>}
            </div>
            {/* Per-Agent TTS */}
            {providers.find((p) => p.type === "xiaomi-mimo" && p.enabled && p.apiKey) && (
              <div className="tts-panel">
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Volume2 size={12} style={{ color: "var(--text-muted)" }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>语音设置</span>
                  <button className={`toggle-switch ${agentTTSConfigs.find((c) => c.agentId === a.id)?.enabled ? "on" : ""}`} onClick={() => {
                    const existing = agentTTSConfigs.find((c) => c.agentId === a.id);
                    const nc: AgentTTSConfig = { agentId: a.id, enabled: !existing?.enabled, voice: existing?.voice ?? "mimo_default", speed: existing?.speed, stylePrompt: existing?.stylePrompt, autoSpeak: existing?.autoSpeak };
                    const ncs = [...agentTTSConfigs.filter((c) => c.agentId !== a.id), nc];
                    setAgentTTSConfigs(ncs);
                    apiFetch("/api/agent-tts-configs", { method: "PUT", body: JSON.stringify({ configs: ncs }) });
                    if (nc.enabled) setTtsEnabled(true);
                  }} style={{ transform: "scale(0.8)" }} />
                </div>
                {agentTTSConfigs.find((c) => c.agentId === a.id)?.enabled && (
                  <div className="tts-controls">
                    <select value={agentTTSConfigs.find((c) => c.agentId === a.id)?.voice ?? "mimo_default"} onChange={(e) => { const ncs = agentTTSConfigs.map((c) => c.agentId === a.id ? { ...c, voice: e.target.value } : c); setAgentTTSConfigs(ncs); apiFetch("/api/agent-tts-configs", { method: "PUT", body: JSON.stringify({ configs: ncs }) }); }}>
                      <option value="mimo_default">默认</option><option value="冰糖">冰糖 ♀</option><option value="茉莉">茉莉 ♀</option><option value="苏打">苏打 ♂</option><option value="白桦">白桦 ♂</option><option value="Mia">Mia EN</option>
                    </select>
                    <select value={agentTTSConfigs.find((c) => c.agentId === a.id)?.speed ?? 1.0} onChange={(e) => { const ncs = agentTTSConfigs.map((c) => c.agentId === a.id ? { ...c, speed: parseFloat(e.target.value) } : c); setAgentTTSConfigs(ncs); apiFetch("/api/agent-tts-configs", { method: "PUT", body: JSON.stringify({ configs: ncs }) }); }}>
                      <option value="0.5">0.5x</option><option value="0.75">0.75x</option><option value="1.0">1.0x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="2.0">2.0x</option>
                    </select>
                    <input placeholder="风格: 温柔/活泼/严肃..." value={agentTTSConfigs.find((c) => c.agentId === a.id)?.stylePrompt ?? ""} onChange={(e) => { const ncs = agentTTSConfigs.map((c) => c.agentId === a.id ? { ...c, stylePrompt: e.target.value } : c); setAgentTTSConfigs(ncs); }} onBlur={() => apiFetch("/api/agent-tts-configs", { method: "PUT", body: JSON.stringify({ configs: agentTTSConfigs }) })} />
                    <button className="icon-btn" onClick={() => speakText("你好，很高兴认识你！", a.id)} disabled={ttsPlaying} style={{ fontSize: 11, padding: "2px 6px" }}>{ttsPlaying ? "⏳" : "🔊"}</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
