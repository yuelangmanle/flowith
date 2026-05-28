import { useState } from "react";
import { Moon, RefreshCw, ShieldCheck, Sun, Volume2, VolumeX, Zap } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, getProviderIcon } from "../lib/shared";
import { saveProviders } from "../core/persistence";
import type { ModelConfig, ProviderConfig } from "../core/types";

export function SettingsView() {
  const {
    providers, setProviders, models, setModels, showToast,
    ttsEnabled, setTtsEnabled, darkMode, toggleDarkMode,
    selectedProviderId, setSelectedProviderId, selectedModelId, setSelectedModelId,
    syncProvidersToServer,
  } = useStore();

  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  const updateProvider = (id: string, updater: (p: ProviderConfig) => ProviderConfig) => {
    const newProviders = providers.map((p) => p.id === id ? updater(p) : p);
    setProviders(newProviders);
    saveProviders(newProviders);
  };

  const enabledProviders = providers.filter((p) => p.enabled);
  const globalProvider = providers.find((p) => p.id === selectedProviderId);
  const globalModel = models.find((m) => m.id === selectedModelId);

  return (
    <div className="settings-container">
      {/* ─── 全局设置 ─── */}
      <div className="settings-section">
        <h3>⚙️ 全局设置</h3>
        <div className="provider-card" style={{ padding: 16 }}>
          {/* 默认模型 */}
          <div className="field-row">
            <label>默认模型</label>
            <div style={{ display: "flex", gap: 6, flex: 1 }}>
              <select
                value={selectedProviderId}
                onChange={(e) => {
                  setSelectedProviderId(e.target.value);
                  const provModels = models.filter((m) => m.providerId === e.target.value);
                  if (provModels.length > 0) setSelectedModelId(provModels[0].id);
                }}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13 }}
              >
                <option value="">未设置</option>
                {enabledProviders.map((p) => (
                  <option key={p.id} value={p.id}>{getProviderIcon(p.type)} {p.name}</option>
                ))}
              </select>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 13 }}
              >
                {!selectedProviderId && <option value="">请选择供应商</option>}
                {selectedProviderId && models.filter((m) => m.providerId === selectedProviderId).length === 0 && <option value="">暂无模型，请先发现</option>}
                {models.filter((m) => m.providerId === selectedProviderId).map((m) => (
                  <option key={m.id} value={m.id}>{m.id} {m.capabilities.reasoning ? "🧠" : ""}{m.capabilities.fast ? "⚡" : ""}{m.capabilities.vision ? "👁" : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            当前: {globalProvider ? `${globalProvider.name} / ${globalModel?.id ?? "未选模型"}` : "未设置"}
          </div>

          {/* 深色模式 */}
          <div className="field-row" style={{ marginTop: 12 }}>
            <label>深色模式</label>
            <button className={`toggle-switch ${darkMode ? "on" : ""}`} onClick={toggleDarkMode}>
              {darkMode ? <Moon size={14} /> : <Sun size={14} />}
            </button>
          </div>

          {/* 全局 TTS */}
          <div className="field-row" style={{ marginTop: 8 }}>
            <label>全局语音朗读</label>
            <button className={`toggle-switch ${ttsEnabled ? "on" : ""}`} onClick={() => setTtsEnabled(!ttsEnabled)}>
              {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          </div>
          {ttsEnabled && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              AI 回复将自动朗读（需启用小米 MiMo 的 TTS）
            </div>
          )}
        </div>
      </div>

      {/* ─── 模型供应商 ─── */}
      <div className="settings-section">
        <h3><Zap size={16} /> 模型供应商配置</h3>
        {providers.map((p) => (
          <div key={p.id} className="provider-card">
            <div
              className="provider-card-header"
              style={{ cursor: "pointer" }}
              onClick={() => setExpandedProvider(expandedProvider === p.id ? null : p.id)}
            >
              <div className="p-name">
                <span style={{ fontSize: 16 }}>{getProviderIcon(p.type)}</span>
                {p.name}
                {p.type === "xiaomi-mimo" && <span style={{ fontSize: 10, color: "var(--primary)", marginLeft: 4, padding: "1px 4px", borderRadius: 3, background: "rgba(78,205,196,0.1)" }}>推荐</span>}
                {p.modelsDiscovered ? <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{p.modelsDiscovered} 模型</span> : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: p.enabled ? "var(--primary)" : "var(--text-muted)" }}>{p.enabled ? "已启用" : "未启用"}</span>
                <button className={`toggle-switch ${p.enabled ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); updateProvider(p.id, (pp) => ({ ...pp, enabled: !pp.enabled })); syncProvidersToServer(); }} />
              </div>
            </div>

            {/* 始终显示基本字段，展开显示全部 */}
            {p.enabled && (
              <div className="p-fields">
                {/* MiMo 专属设置 */}
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

                    {/* TTS 设置（展开显示） */}
                    {expandedProvider === p.id && (
                      <>
                        <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0", paddingTop: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                            <Volume2 size={14} /> TTS 语音设置
                          </div>
                        </div>
                        <div className="field-row">
                          <label>启用 TTS</label>
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
                                <option value="冰糖">冰糖 (女声)</option>
                                <option value="茉莉">茉莉 (女声)</option>
                                <option value="苏打">苏打 (男声)</option>
                                <option value="白桦">白桦 (男声)</option>
                                <option value="Mia">Mia (英文)</option>
                              </select>
                            </div>
                            <div className="field-row">
                              <label>TTS 模型</label>
                              <select value={p.ttsModel ?? "mimo-v2.5-tts"} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, ttsModel: e.target.value }))} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                                <option value="mimo-v2.5-tts">内置音色</option>
                                <option value="mimo-v2.5-tts-voicedesign">音色设计</option>
                                <option value="mimo-v2.5-tts-voiceclone">音色克隆</option>
                              </select>
                            </div>
                            <div className="field-row">
                              <label>语速</label>
                              <select value={p.ttsSpeed ?? 1.0} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, ttsSpeed: parseFloat(e.target.value) }))} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                                <option value="0.5">0.5x 慢速</option>
                                <option value="0.75">0.75x</option>
                                <option value="1.0">1.0x 正常</option>
                                <option value="1.25">1.25x</option>
                                <option value="1.5">1.5x 快速</option>
                                <option value="2.0">2.0x 极快</option>
                              </select>
                            </div>
                            <div className="field-row">
                              <label>风格指令</label>
                              <input placeholder="如: 温柔/活泼/磁性/严肃/东北话/粤语/唱歌..." value={p.ttsStylePrompt ?? ""} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, ttsStylePrompt: e.target.value }))} />
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.6 }}>
                              <strong>风格参考：</strong> 情感(温柔/高冷/活泼/严肃/慵懒) | 音色(磁性/醇厚/清亮/空灵/甜美) | 腔调(御姐/正太/大叔/台湾腔) | 方言(东北话/四川话/粤语)
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}

                {/* 非 MiMo 的通用设置 */}
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

                {/* 操作按钮 */}
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
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
