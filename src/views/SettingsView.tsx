import { RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, getProviderIcon } from "../lib/shared";
import { saveProviders } from "../core/persistence";
import type { ModelConfig, ProviderConfig } from "../core/types";

export function SettingsView() {
  const { providers, setProviders, models, setModels, showToast, ttsEnabled, setTtsEnabled, syncProvidersToServer } = useStore();

  const updateProvider = (id: string, updater: (p: ProviderConfig) => ProviderConfig) => {
    const newProviders = providers.map((p) => p.id === id ? updater(p) : p);
    setProviders(newProviders);
    saveProviders(newProviders);
  };

  return (
    <div className="settings-container">
      <div className="settings-section">
        <h3><Zap size={16} /> 模型供应商配置</h3>
        {providers.map((p) => (
          <div key={p.id} className="provider-card">
            <div className="provider-card-header">
              <div className="p-name">
                <span style={{ fontSize: 16 }}>{getProviderIcon(p.type)}</span>
                {p.name}
                {p.modelsDiscovered ? <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{p.modelsDiscovered} 模型</span> : null}
              </div>
              <button className={`toggle-switch ${p.enabled ? "on" : ""}`} onClick={() => { updateProvider(p.id, (pp) => ({ ...pp, enabled: !pp.enabled })); syncProvidersToServer(); }} />
            </div>
            {p.enabled && (
              <div className="p-fields">
                {p.type === "xiaomi-mimo" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input type="password" placeholder="输入 MiMo API Key" value={p.apiKey} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, apiKey: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>API 地址</label>
                      <select value={p.altBaseUrl || p.baseUrl} onChange={(e) => {
                        const v = e.target.value;
                        if (v === "https://token-plan-cn.xiaomimimo.com/v1") {
                          updateProvider(p.id, (pp) => ({ ...pp, baseUrl: "https://api.xiaomimimo.com/v1", altBaseUrl: v }));
                        } else {
                          updateProvider(p.id, (pp) => ({ ...pp, baseUrl: v, altBaseUrl: undefined }));
                        }
                        syncProvidersToServer();
                      }} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <option value="https://api.xiaomimimo.com/v1">标准 (api.xiaomimimo.com)</option>
                        <option value="https://token-plan-cn.xiaomimimo.com/v1">Token Plan CN</option>
                      </select>
                    </div>
                    <div className="field-row">
                      <label>联网搜索</label>
                      <button className={`toggle-switch ${p.webSearchEnabled ? "on" : ""}`} onClick={() => { updateProvider(p.id, (pp) => ({ ...pp, webSearchEnabled: !pp.webSearchEnabled })); syncProvidersToServer(); }} />
                    </div>
                    <div className="field-row">
                      <label>TTS 语音</label>
                      <button className={`toggle-switch ${p.ttsEnabled ? "on" : ""}`} onClick={() => {
                        updateProvider(p.id, (pp) => ({ ...pp, ttsEnabled: !pp.ttsEnabled }));
                        if (!p.ttsEnabled) setTtsEnabled(true);
                        syncProvidersToServer();
                      }} />
                    </div>
                    {p.ttsEnabled && (
                      <>
                        <div className="field-row">
                          <label>音色</label>
                          <select value={p.ttsVoice ?? "mimo_default"} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, ttsVoice: e.target.value }))} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                            <option value="mimo_default">默认 (冰糖)</option>
                            <option value="冰糖">冰糖 (女)</option>
                            <option value="茉莉">茉莉 (女)</option>
                            <option value="苏打">苏打 (男)</option>
                            <option value="白桦">白桦 (男)</option>
                            <option value="Mia">Mia (EN)</option>
                          </select>
                        </div>
                        <div className="field-row">
                          <label>TTS 模型</label>
                          <select value={p.ttsModel ?? "mimo-v2.5-tts"} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, ttsModel: e.target.value }))} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                            <option value="mimo-v2.5-tts">内置音色 (mimo-v2.5-tts)</option>
                            <option value="mimo-v2.5-tts-voicedesign">音色设计 (voicedesign)</option>
                            <option value="mimo-v2.5-tts-voiceclone">音色克隆 (voiceclone)</option>
                          </select>
                        </div>
                        <div className="field-row">
                          <label>语速</label>
                          <select value={p.ttsSpeed ?? 1.0} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, ttsSpeed: parseFloat(e.target.value) }))} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                            <option value="0.5">0.5x 慢速</option><option value="0.75">0.75x</option><option value="1.0">1.0x 正常</option>
                            <option value="1.25">1.25x</option><option value="1.5">1.5x 快速</option><option value="2.0">2.0x 极快</option>
                          </select>
                        </div>
                        <div className="field-row">
                          <label>风格指令</label>
                          <input placeholder="如: 温柔/活泼/磁性/严肃/东北话/粤语/唱歌..." value={p.ttsStylePrompt ?? ""} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, ttsStylePrompt: e.target.value }))} />
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.5 }}>
                          支持风格: 情感(温柔/高冷/活泼/严肃/慵懒) | 音色(磁性/醇厚/清亮/空灵/甜美) | 腔调(御姐音/正太音/大叔音/台湾腔) | 方言(东北话/四川话/粤语)
                        </div>
                      </>
                    )}
                  </>
                )}
                {p.type !== "ollama" && p.type !== "xiaomi-mimo" && (
                  <div className="field-row">
                    <label>API Key</label>
                    <input type="password" placeholder="sk-..." value={p.apiKey} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, apiKey: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                  </div>
                )}
                {p.type !== "xiaomi-mimo" && (
                  <div className="field-row">
                    <label>Base URL</label>
                    <input value={p.baseUrl} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, baseUrl: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                  </div>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                  <button onClick={async () => {
                    const resp = await apiFetch("/api/providers/test", { method: "POST", body: JSON.stringify({ providerId: p.id }) });
                    const data = await resp.json() as { ok: boolean; modelCount: number; latencyMs: number; error?: string };
                    showToast(data.ok ? `连接成功! ${data.modelCount} 模型, ${data.latencyMs}ms` : `连接失败: ${data.error}`, data.ok ? "success" : "error");
                  }}><ShieldCheck size={14} /> 测试连接</button>
                  <button onClick={async () => {
                    const resp = await apiFetch("/api/providers/discover", { method: "POST", body: JSON.stringify({ providerId: p.id }) });
                    if (resp.ok) {
                      const data = await resp.json() as { models: ModelConfig[]; count: number };
                      setModels((prev) => [...prev.filter((m) => m.providerId !== p.id), ...data.models]);
                      updateProvider(p.id, (pp) => ({ ...pp, modelsDiscovered: data.count }));
                      showToast(`发现 ${data.count} 个模型`, "success");
                    }
                  }}><RefreshCw size={14} /> 发现模型</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
