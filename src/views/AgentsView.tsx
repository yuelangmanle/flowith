import { useState } from "react";
import { Bot, Plus, Trash2, Volume2, Sparkles, Loader2 } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, getProviderIcon } from "../lib/shared";
import type { AgentConfig, AgentTTSConfig } from "../core/types";

export function AgentsView() {
  const { agents, setAgents, providers, models, selectedProviderId, selectedModelId, agentModelConfigs, setAgentModelConfigs, agentTTSConfigs, setAgentTTSConfigs, ttsProviders, ttsPlaying, showToast, getEffectiveConfig } = useStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiDesc, setAiDesc] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AgentConfig["role"]>("coder");
  const [newPrompt, setNewPrompt] = useState("");
  const [newAvatar, setNewAvatar] = useState("✦");

  const ttsEnabledGlobal = useStore((s) => s.ttsEnabled);
  const setTtsEnabled = useStore((s) => s.setTtsEnabled);
  const setTtsPlaying = useStore((s) => s.setTtsPlaying);

  const speakText = async (text: string, agentId?: string) => {
    const agentTTS = agentId ? agentTTSConfigs.find((c) => c.agentId === agentId) : undefined;
    if (!ttsEnabledGlobal && !agentTTS?.enabled) return;
    setTtsPlaying(true);
    try {
      const resp = await apiFetch("/api/tts", { method: "POST", body: JSON.stringify({ text: text.slice(0, 2000), voice: agentTTS?.voice, stylePrompt: agentTTS?.stylePrompt, speed: agentTTS?.speed, format: "wav", agentId, ttsProviderId: agentTTS?.ttsProviderId }) });
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

  const aiCreateAgent = async () => {
    if (!aiDesc.trim()) return;
    setAiLoading(true);
    try {
      const cfg = getEffectiveConfig("agent-moderator");
      const resp = await apiFetch("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          providerId: cfg.providerId,
          model: cfg.modelId,
          messages: [
            { role: "system", content: "你是一个 Agent 配置生成器。用户会描述他们需要什么样的 AI Agent，你需要返回一个 JSON 对象，包含以下字段：name（中文名称，2-4字）、role（从以下选一个：coder/researcher/product/testing/documentation/moderator/architecture/ui/review/critic）、avatar（一个 emoji）、systemPrompt（详细的系统提示词，中文）、goal（一句话目标，中文）、color（十六进制颜色代码）。只返回 JSON，不要其他内容。" },
            { role: "user", content: aiDesc },
          ],
          stream: false,
        }),
      });
      if (resp.ok) {
        const data = await resp.json() as { content?: string };
        const text = data.content ?? "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          setNewName(parsed.name ?? "");
          setNewRole(parsed.role ?? "coder");
          setNewAvatar(parsed.avatar ?? "✦");
          setNewPrompt(parsed.systemPrompt ?? "");
          setShowAI(false);
          setShowCreate(true);
          showToast("AI 已生成配置，请确认后创建", "success");
        }
      }
    } catch {
      showToast("AI 生成失败，请手动创建", "error");
    }
    setAiLoading(false);
  };

  return (
    <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Bot size={18} /> Agent 管理</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setShowAI(!showAI); setShowCreate(false); }} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--primary)", background: "transparent", color: "var(--primary)", cursor: "pointer", fontSize: 13 }}><Sparkles size={14} /> AI 帮我创建</button>
          <button className="primary" onClick={() => { setShowCreate(!showCreate); setShowAI(false); }}><Plus size={14} /> 创建 Agent</button>
        </div>
      </div>

      {showAI && (
        <div className="provider-card" style={{ marginBottom: 16, border: "1px solid var(--primary)" }}>
          <h4 style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={14} /> AI 辅助创建</h4>
          <div className="p-fields">
            <div className="field-row">
              <label>描述需求</label>
              <textarea value={aiDesc} onChange={(e) => setAiDesc(e.target.value)} placeholder="例如：我需要一个专门帮我写论文的 Agent，擅长学术写作和文献综述..." style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", minHeight: 80, fontFamily: "var(--font)", fontSize: 13 }} />
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="primary" onClick={aiCreateAgent} disabled={aiLoading || !aiDesc.trim()}>
                {aiLoading ? <><Loader2 size={14} className="spin" /> 生成中...</> : <><Sparkles size={14} /> 生成 Agent</>}
              </button>
              <button onClick={() => setShowAI(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="provider-card" style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 10 }}>创建自定义 Agent</h4>
          <div className="p-fields">
            <div className="field-row"><label>名称</label><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Agent 名称" /></div>
            <div className="field-row"><label>Emoji</label><input value={newAvatar} onChange={(e) => setNewAvatar(e.target.value)} style={{ width: 50, textAlign: "center" }} /></div>
            <div className="field-row"><label>角色</label><select value={newRole} onChange={(e) => setNewRole(e.target.value as AgentConfig["role"])} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
              <option value="coder">编码</option><option value="researcher">研究</option><option value="product">产品</option><option value="testing">测试</option><option value="documentation">文档</option><option value="moderator">主持</option><option value="architecture">架构</option><option value="ui">UI设计</option><option value="review">审查</option><option value="critic">反方</option>
            </select></div>
            <div className="field-row"><label>System Prompt</label><textarea value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder="定义 Agent 的行为..." style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", minHeight: 60, fontFamily: "var(--font)", fontSize: 13 }} /></div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="primary" onClick={async () => {
                if (!newName.trim()) return;
                const resp = await apiFetch("/api/agents", { method: "POST", body: JSON.stringify({ name: newName, role: newRole, avatar: newAvatar, systemPrompt: newPrompt, goal: newPrompt.slice(0, 50) }) });
                if (resp.ok) { const a = await resp.json() as AgentConfig; setAgents((prev) => [...prev, a]); setShowCreate(false); setNewName(""); setNewPrompt(""); setNewAvatar("✦"); showToast("Agent 已创建", "success"); }
              }}>创建</button>
              <button onClick={() => setShowCreate(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {agents.map((a) => {
        const agentCfg = agentModelConfigs.find((c) => c.agentId === a.id && !c.useGlobal);
        const globalProv = providers.find((p) => p.id === selectedProviderId);
        const globalModel = models.find((m) => m.id === selectedModelId);
        const effectiveModel = agentCfg?.modelId ?? (globalModel ? `${globalProv?.name ?? ""} / ${globalModel.id}` : "未配置");
        return (
          <div key={a.id} className="provider-card" style={{ marginBottom: 8, borderLeft: `3px solid ${a.color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>{a.avatar}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.name} {a.custom && <span style={{ fontSize: 10, color: "var(--primary)" }}>自定义</span>}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.goal}</div>
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-active)", padding: "2px 6px", borderRadius: 4 }}>{a.role}</span>
              {a.custom && <button className="icon-btn" onClick={() => {
                setAgents((prev) => prev.filter((ag) => ag.id !== a.id));
                apiFetch(`/api/agents/${a.id}`, { method: "DELETE" });
              }} style={{ color: "var(--accent)" }}><Trash2 size={14} /></button>}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>{a.systemPrompt}</div>
            {/* Per-Agent Model */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>模型:</span>
              <select value={agentCfg?.providerId ?? ""} onChange={(e) => {
                const v = e.target.value;
                const nc = agentModelConfigs.filter((c) => c.agentId !== a.id);
                if (v) { const pm = models.filter((m) => m.providerId === v); nc.push({ agentId: a.id, providerId: v, modelId: pm[0]?.id ?? "" }); }
                setAgentModelConfigs(nc); apiFetch("/api/agent-models", { method: "PUT", body: JSON.stringify({ configs: nc }) });
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
                {agentCfg && models.filter((m) => m.providerId === agentCfg.providerId).map((m) => <option key={m.id} value={m.id}>{m.id} {m.capabilities.reasoning ? " [思考]" : ""}{m.capabilities.fast ? " [快]" : ""}{m.capabilities.vision ? " [视觉]" : ""}</option>)}
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
                    const nc: AgentTTSConfig = { agentId: a.id, enabled: !existing?.enabled, ttsProviderId: existing?.ttsProviderId, voice: existing?.voice, speed: existing?.speed, stylePrompt: existing?.stylePrompt, autoSpeak: existing?.autoSpeak };
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
