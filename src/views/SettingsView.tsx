import { useState } from "react";
import { Moon, RefreshCw, ShieldCheck, Sun, Volume2, VolumeX, Zap } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, getProviderIcon } from "../lib/shared";
import { saveProviders } from "../core/persistence";
import type { ModelConfig, ProviderConfig, TTSProviderConfig } from "../core/types";

// ─── TTS Provider Icons ────────────────────────────────────────

function getTTSIcon(type: string): string {
  const icons: Record<string, string> = {
    "mimo-tts": "🎙️",
    "openai-tts": "🔊",
    "edge-tts": "🌐",
    "fish-audio": "🐟",
    "custom-tts": "⚙️",
  };
  return icons[type] ?? "🔊";
}

// ─── Main Settings View ────────────────────────────────────────

export function SettingsView() {
  const {
    providers, setProviders, models, setModels, showToast,
    ttsProviders, setTTSProviders, syncTTSProvidersToServer,
    ttsEnabled, setTtsEnabled, darkMode, toggleDarkMode,
    selectedProviderId, setSelectedProviderId, selectedModelId, setSelectedModelId,
    syncProvidersToServer,
  } = useStore();

  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [expandedTTS, setExpandedTTS] = useState<string | null>(null);

  const updateProvider = (id: string, updater: (p: ProviderConfig) => ProviderConfig) => {
    const newProviders = providers.map((p) => p.id === id ? updater(p) : p);
    setProviders(newProviders);
    saveProviders(newProviders);
  };

  const updateTTSProvider = (id: string, updater: (p: TTSProviderConfig) => TTSProviderConfig) => {
    const newProviders = ttsProviders.map((p) => p.id === id ? updater(p) : p);
    setTTSProviders(newProviders);
    syncTTSProvidersToServer();
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
                  <option key={m.id} value={m.id}>{m.id} {m.capabilities.reasoning ? " [思考]" : ""}{m.capabilities.fast ? " [快]" : ""}{m.capabilities.vision ? " [视觉]" : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            当前: {globalProvider ? `${globalProvider.name} / ${globalModel?.id ?? "未选模型"}` : "未设置"}
          </div>

          <div className="field-row" style={{ marginTop: 12 }}>
            <label>深色模式</label>
            <button className={`toggle-switch ${darkMode ? "on" : ""}`} onClick={toggleDarkMode}>
              {darkMode ? <Moon size={14} /> : <Sun size={14} />}
            </button>
          </div>

          <div className="field-row" style={{ marginTop: 8 }}>
            <label>全局语音朗读</label>
            <button className={`toggle-switch ${ttsEnabled ? "on" : ""}`} onClick={() => setTtsEnabled(!ttsEnabled)}>
              {ttsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          </div>
          {ttsEnabled && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
              AI 回复将自动朗读 · 请在下方 TTS 语音服务商中配置引擎
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

            {p.enabled && (
              <div className="p-fields">
                {/* ── MiMo 专属设置 ── */}
                {p.type === "xiaomi-mimo" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input type="password" placeholder="输入 MiMo API Key" value={p.apiKey} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, apiKey: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>API 地址</label>
                      <input
                        value={p.altBaseUrl || p.baseUrl}
                        placeholder="https://api.xiaomimimo.com/v1"
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          if (v.includes("token-plan-cn")) {
                            updateProvider(p.id, (pp) => ({ ...pp, baseUrl: "https://api.xiaomimimo.com/v1", altBaseUrl: v }));
                          } else {
                            updateProvider(p.id, (pp) => ({ ...pp, baseUrl: v || "https://api.xiaomimimo.com/v1", altBaseUrl: undefined }));
                          }
                        }}
                        onBlur={() => syncProvidersToServer()}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                      {[["https://api.xiaomimimo.com/v1", "标准"], ["https://token-plan-cn.xiaomimimo.com/v1", "Token Plan CN"]].map(([url, label]) => (
                        <button key={url} onClick={() => {
                          if (url.includes("token-plan-cn")) {
                            updateProvider(p.id, (pp) => ({ ...pp, baseUrl: "https://api.xiaomimimo.com/v1", altBaseUrl: url }));
                          } else {
                            updateProvider(p.id, (pp) => ({ ...pp, baseUrl: url, altBaseUrl: undefined }));
                          }
                          syncProvidersToServer();
                        }} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)", background: (p.altBaseUrl || p.baseUrl) === url ? "rgba(78,205,196,0.15)" : "var(--bg)", cursor: "pointer" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="field-row">
                      <label>联网搜索</label>
                      <button className={`toggle-switch ${p.webSearchEnabled ? "on" : ""}`} onClick={() => { updateProvider(p.id, (pp) => ({ ...pp, webSearchEnabled: !pp.webSearchEnabled })); syncProvidersToServer(); }} />
                    </div>
                  </>
                )}

                {/* ── DeepSeek 专属设置 ── */}
                {p.type === "deepseek" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input type="password" placeholder="sk-..." value={p.apiKey} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, apiKey: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>Base URL</label>
                      <input value={p.baseUrl} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, baseUrl: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>推理强度</label>
                      <select value={p.reasoningEffort ?? "medium"} onChange={(e) => { updateProvider(p.id, (pp) => ({ ...pp, reasoningEffort: e.target.value as "low" | "medium" | "high" })); syncProvidersToServer(); }} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <option value="low">低 (省 token)</option>
                        <option value="medium">中 (默认)</option>
                        <option value="high">高 (深度推理)</option>
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.6 }}>
                      <strong>DeepSeek 调优：</strong> reasoner 模型自动 temperature=0；推理强度影响 reasoning token 数量
                    </div>
                  </>
                )}

                {/* ── Qwen 专属设置 ── */}
                {p.type === "qwen" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input type="password" placeholder="sk-..." value={p.apiKey} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, apiKey: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>Base URL</label>
                      <input value={p.baseUrl} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, baseUrl: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>联网搜索</label>
                      <button className={`toggle-switch ${p.enableSearch ? "on" : ""}`} onClick={() => { updateProvider(p.id, (pp) => ({ ...pp, enableSearch: !pp.enableSearch })); syncProvidersToServer(); }} />
                    </div>
                    <div className="field-row">
                      <label>Qwen3 思考模式</label>
                      <button className={`toggle-switch ${p.enableThinking ? "on" : ""}`} onClick={() => { updateProvider(p.id, (pp) => ({ ...pp, enableThinking: !pp.enableThinking })); syncProvidersToServer(); }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.6 }}>
                      <strong>Qwen 调优：</strong> qwen3 开启思考模式后会输出推理过程；VL 模型自动支持图片输入
                    </div>
                  </>
                )}

                {/* ── Moonshot 专属设置 ── */}
                {p.type === "moonshot" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input type="password" placeholder="sk-..." value={p.apiKey} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, apiKey: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>Base URL</label>
                      <input value={p.baseUrl} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, baseUrl: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>联网搜索</label>
                      <button className={`toggle-switch ${p.moonshotWebSearch ? "on" : ""}`} onClick={() => { updateProvider(p.id, (pp) => ({ ...pp, moonshotWebSearch: !pp.moonshotWebSearch })); syncProvidersToServer(); }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.6 }}>
                      <strong>Moonshot 调优：</strong> kimi-k2 自动使用低 temperature；联网搜索使用内置 $web_search 工具
                    </div>
                  </>
                )}

                {/* ── OpenAI 专属设置 ── */}
                {p.type === "openai" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input type="password" placeholder="sk-..." value={p.apiKey} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, apiKey: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>Base URL</label>
                      <input value={p.baseUrl} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, baseUrl: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>推理强度 (o-series)</label>
                      <select value={p.reasoningEffort ?? "medium"} onChange={(e) => { updateProvider(p.id, (pp) => ({ ...pp, reasoningEffort: e.target.value as "low" | "medium" | "high" })); syncProvidersToServer(); }} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.6 }}>
                      <strong>OpenAI 调优：</strong> o3/o4 系列自动设置 reasoning_effort；GPT-4o/4.1 支持视觉
                    </div>
                  </>
                )}

                {/* ── Anthropic 专属设置 ── */}
                {p.type === "anthropic" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input type="password" placeholder="sk-ant-..." value={p.apiKey} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, apiKey: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>Base URL</label>
                      <input value={p.baseUrl} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, baseUrl: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.6 }}>
                      <strong>Anthropic 调优：</strong> Claude Sonnet/Opus 4 自动启用扩展思考（extended thinking）；使用 Messages API
                    </div>
                  </>
                )}

                {/* ── Gemini 专属设置 ── */}
                {p.type === "gemini" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input type="password" placeholder="AIza..." value={p.apiKey} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, apiKey: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>Base URL</label>
                      <input value={p.baseUrl} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, baseUrl: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.6 }}>
                      <strong>Gemini 调优：</strong> 2.5 Pro/Flash 自动启用 thinkingConfig；使用 GenerateContent API；API Key 认证
                    </div>
                  </>
                )}

                {/* ── Ollama 设置 ── */}
                {p.type === "ollama" && (
                  <div className="field-row">
                    <label>Base URL</label>
                    <input value={p.baseUrl} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, baseUrl: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                  </div>
                )}

                {/* ── OpenAI-Compatible 设置 ── */}
                {p.type === "openai-compatible" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input type="password" placeholder="sk-..." value={p.apiKey} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, apiKey: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                    <div className="field-row">
                      <label>Base URL</label>
                      <input value={p.baseUrl} onChange={(e) => updateProvider(p.id, (pp) => ({ ...pp, baseUrl: e.target.value }))} onBlur={() => syncProvidersToServer()} />
                    </div>
                  </>
                )}

                {/* ── 操作按钮 ── */}
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

      {/* ─── TTS 语音服务商 ─── */}
      <div className="settings-section">
        <h3><Volume2 size={16} /> TTS 语音服务商</h3>
        {ttsProviders.map((tp) => (
          <div key={tp.id} className="provider-card">
            <div
              className="provider-card-header"
              style={{ cursor: "pointer" }}
              onClick={() => setExpandedTTS(expandedTTS === tp.id ? null : tp.id)}
            >
              <div className="p-name">
                <span style={{ fontSize: 16 }}>{getTTSIcon(tp.type)}</span>
                {tp.name}
                {tp.type === "mimo-tts" && <span style={{ fontSize: 10, color: "var(--primary)", marginLeft: 4, padding: "1px 4px", borderRadius: 3, background: "rgba(78,205,196,0.1)" }}>推荐</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: tp.enabled ? "var(--primary)" : "var(--text-muted)" }}>{tp.enabled ? "已启用" : "未启用"}</span>
                <button className={`toggle-switch ${tp.enabled ? "on" : ""}`} onClick={(e) => { e.stopPropagation(); updateTTSProvider(tp.id, (t) => ({ ...t, enabled: !t.enabled })); }} />
              </div>
            </div>

            {tp.enabled && (
              <div className="p-fields">
                {/* MiMo TTS */}
                {tp.type === "mimo-tts" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input type="password" placeholder="tp-..." value={tp.apiKey} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, apiKey: e.target.value }))} />
                    </div>
                    <div className="field-row">
                      <label>API 地址</label>
                      <input
                        value={tp.mimoAltBaseUrl || tp.baseUrl}
                        placeholder="https://api.xiaomimimo.com/v1"
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          if (v.includes("token-plan-cn")) {
                            updateTTSProvider(tp.id, (t) => ({ ...t, baseUrl: "https://api.xiaomimimo.com/v1", mimoAltBaseUrl: v }));
                          } else {
                            updateTTSProvider(tp.id, (t) => ({ ...t, baseUrl: v || "https://api.xiaomimimo.com/v1", mimoAltBaseUrl: undefined }));
                          }
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                      {[["https://api.xiaomimimo.com/v1", "标准"], ["https://token-plan-cn.xiaomimimo.com/v1", "Token Plan CN"]].map(([url, label]) => (
                        <button key={url} onClick={() => {
                          if (url.includes("token-plan-cn")) {
                            updateTTSProvider(tp.id, (t) => ({ ...t, baseUrl: "https://api.xiaomimimo.com/v1", mimoAltBaseUrl: url }));
                          } else {
                            updateTTSProvider(tp.id, (t) => ({ ...t, baseUrl: url, mimoAltBaseUrl: undefined }));
                          }
                        }} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border)", background: (tp.mimoAltBaseUrl || tp.baseUrl) === url ? "rgba(78,205,196,0.15)" : "var(--bg)", cursor: "pointer" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="field-row">
                      <label>TTS 模型</label>
                      <select value={tp.defaultModel ?? "mimo-v2.5-tts"} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, defaultModel: e.target.value }))} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <option value="mimo-v2.5-tts">内置音色</option>
                        <option value="mimo-v2.5-tts-voicedesign">音色设计</option>
                        <option value="mimo-v2.5-tts-voiceclone">音色克隆</option>
                      </select>
                    </div>
                    <div className="field-row">
                      <label>默认音色</label>
                      <select value={tp.defaultVoice ?? "mimo_default"} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, defaultVoice: e.target.value }))} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <option value="mimo_default">默认 (冰糖)</option>
                        <option value="冰糖">冰糖 (女声)</option>
                        <option value="茉莉">茉莉 (女声)</option>
                        <option value="苏打">苏打 (男声)</option>
                        <option value="白桦">白桦 (男声)</option>
                        <option value="Mia">Mia (英文)</option>
                      </select>
                    </div>
                    <div className="field-row">
                      <label>风格指令</label>
                      <input placeholder="如: 温柔/活泼/磁性/严肃/东北话/粤语/唱歌..." value={tp.defaultStylePrompt ?? ""} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, defaultStylePrompt: e.target.value }))} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.6 }}>
                      <strong>风格参考：</strong> 情感(温柔/高冷/活泼/严肃/慵懒) | 音色(磁性/醇厚/清亮/空灵/甜美) | 腔调(御姐/正太/大叔/台湾腔) | 方言(东北话/四川话/粤语)
                    </div>
                  </>
                )}

                {/* OpenAI TTS */}
                {tp.type === "openai-tts" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input type="password" placeholder="sk-..." value={tp.apiKey} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, apiKey: e.target.value }))} />
                    </div>
                    <div className="field-row">
                      <label>Base URL</label>
                      <input value={tp.baseUrl} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, baseUrl: e.target.value }))} />
                    </div>
                    <div className="field-row">
                      <label>模型</label>
                      <select value={tp.defaultModel ?? "tts-1"} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, defaultModel: e.target.value }))} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <option value="tts-1">tts-1 (快速)</option>
                        <option value="tts-1-hd">tts-1-hd (高质量)</option>
                        <option value="gpt-4o-mini-tts">gpt-4o-mini-tts (可控)</option>
                      </select>
                    </div>
                    <div className="field-row">
                      <label>默认音色</label>
                      <select value={tp.defaultVoice ?? "alloy"} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, defaultVoice: e.target.value }))} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <option value="alloy">Alloy (中性)</option>
                        <option value="echo">Echo (男声)</option>
                        <option value="fable">Fable (叙事)</option>
                        <option value="onyx">Onyx (深沉)</option>
                        <option value="nova">Nova (女声)</option>
                        <option value="shimmer">Shimmer (柔和)</option>
                      </select>
                    </div>
                    <div className="field-row">
                      <label>风格指令</label>
                      <input placeholder="如: Speak in a warm, friendly tone..." value={tp.openaiInstructions ?? ""} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, openaiInstructions: e.target.value }))} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.6 }}>
                      <strong>OpenAI TTS：</strong> gpt-4o-mini-tts 支持自然语言指令控制语气、情感、语速
                    </div>
                  </>
                )}

                {/* Fish Audio */}
                {tp.type === "fish-audio" && (
                  <>
                    <div className="field-row">
                      <label>API Key</label>
                      <input type="password" placeholder="..." value={tp.apiKey} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, apiKey: e.target.value }))} />
                    </div>
                    <div className="field-row">
                      <label>Base URL</label>
                      <input value={tp.baseUrl} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, baseUrl: e.target.value }))} />
                    </div>
                    <div className="field-row">
                      <label>参考音色 ID</label>
                      <input placeholder="Fish Audio 音色克隆 ID" value={tp.fishReferenceId ?? ""} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, fishReferenceId: e.target.value }))} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.6 }}>
                      <strong>Fish Audio：</strong> 高质量语音克隆，支持中英日韩多语言
                    </div>
                  </>
                )}

                {/* Edge TTS */}
                {tp.type === "edge-tts" && (
                  <>
                    <div className="field-row">
                      <label>代理地址</label>
                      <input placeholder="http://localhost:9000" value={tp.baseUrl} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, baseUrl: e.target.value }))} />
                    </div>
                    <div className="field-row">
                      <label>默认音色</label>
                      <select value={tp.defaultVoice ?? "zh-CN-XiaoxiaoNeural"} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, defaultVoice: e.target.value }))} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <option value="zh-CN-XiaoxiaoNeural">晓晓 (女声)</option>
                        <option value="zh-CN-YunxiNeural">云希 (男声)</option>
                        <option value="zh-CN-YunjianNeural">云健 (男声)</option>
                        <option value="zh-CN-XiaoyiNeural">晓艺 (女声)</option>
                        <option value="en-US-JennyNeural">Jenny (英文女声)</option>
                        <option value="en-US-GuyNeural">Guy (英文男声)</option>
                      </select>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.6 }}>
                      <strong>Edge TTS：</strong> 免费微软语音合成，需部署 edge-tts REST 代理
                    </div>
                  </>
                )}

                {/* Custom TTS */}
                {tp.type === "custom-tts" && (
                  <>
                    <div className="field-row">
                      <label>API Key (可选)</label>
                      <input type="password" placeholder="..." value={tp.apiKey} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, apiKey: e.target.value }))} />
                    </div>
                    <div className="field-row">
                      <label>Base URL</label>
                      <input placeholder="http://localhost:9000" value={tp.baseUrl} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, baseUrl: e.target.value }))} />
                    </div>
                    <div className="field-row">
                      <label>请求模板 (JSON)</label>
                      <input placeholder='{"text":"{{text}}","voice":"{{voice}}"}' value={tp.requestTemplate ?? ""} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, requestTemplate: e.target.value }))} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", padding: "0 0 4px", lineHeight: 1.6 }}>
                      <strong>自定义 TTS：</strong> 支持任意 REST API，模板变量: {"{{text}}"}, {"{{voice}}"}, {"{{model}}"}, {"{{speed}}"}, {"{{format}}"}
                    </div>
                  </>
                )}

                {/* 通用: 语速和格式 */}
                {tp.type !== "edge-tts" && (
                  <>
                    <div className="field-row">
                      <label>默认语速</label>
                      <select value={tp.defaultSpeed ?? 1.0} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, defaultSpeed: parseFloat(e.target.value) }))} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <option value="0.5">0.5x 慢速</option>
                        <option value="0.75">0.75x</option>
                        <option value="1.0">1.0x 正常</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x 快速</option>
                        <option value="2.0">2.0x 极快</option>
                      </select>
                    </div>
                    <div className="field-row">
                      <label>输出格式</label>
                      <select value={tp.defaultFormat ?? "wav"} onChange={(e) => updateTTSProvider(tp.id, (t) => ({ ...t, defaultFormat: e.target.value as "wav" | "mp3" | "pcm16" }))} style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <option value="wav">WAV (无损)</option>
                        <option value="mp3">MP3 (压缩)</option>
                        <option value="pcm16">PCM16 (原始)</option>
                      </select>
                    </div>
                  </>
                )}

                {/* 测试 TTS 按钮 */}
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button onClick={async () => {
                    try {
                      const resp = await apiFetch("/api/tts", {
                        method: "POST",
                        body: JSON.stringify({ text: "你好，这是语音合成测试。", ttsProviderId: tp.id }),
                      });
                      if (resp.ok) {
                        const data = await resp.json() as { audioBase64: string; format: string };
                        const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
                        const blob = new Blob([bytes], { type: `audio/${data.format}` });
                        const url = URL.createObjectURL(blob);
                        const audio = new Audio(url);
                        audio.onended = () => URL.revokeObjectURL(url);
                        await audio.play();
                        showToast("TTS 测试成功", "success");
                      } else {
                        const err = await resp.json() as { error: string };
                        showToast(`TTS 测试失败: ${err.error}`, "error");
                      }
                    } catch (err) {
                      showToast(`TTS 错误: ${err instanceof Error ? err.message : String(err)}`, "error");
                    }
                  }}><Volume2 size={14} /> 测试 TTS</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Changelog */}
      <ChangelogSection />
    </div>
  );
}

// ─── Changelog Section ─────────────────────────────────────────

function ChangelogSection() {
  const [expanded, setExpanded] = useState(false);
  const versions = [
    {
      version: "v1.3.0",
      date: "2026-05-29",
      changes: [
        "📱 安卓端完整重做：所有功能对标桌面端",
        "🧩 共享渲染组件提取：MessageRenderer、CodeBlock、ThinkingBlock、ImageLightbox",
        "💬 移动端对话：markdown 渲染、代码高亮、思考过程、多图上传、文件附件",
        "⚙️ 移动端完整设置、记忆管理、技能市场、Agent 管理、代码生成",
        "🎉 移动端首次引导 SetupWizard",
      ],
    },
    {
      version: "v1.2.1",
      date: "2026-05-29",
      changes: [
        "🔧 修复 macOS x86_64 CI 构建失败问题",
        "🐛 修复 Skills 上下文缓存重复清理",
        "🏗️ TypeScript 编译警告修复",
      ],
    },
    {
      version: "v1.1.0",
      date: "2026-05-29",
      changes: [
        "🧠 记忆系统完整增强：自动捕获、自动注入、规则整合、自动去重",
        "🔍 搜索算法升级：Jaccard 相似度 + 停用词过滤",
        "💬 圆桌讨论记忆集成",
        "⚡ Anthropic prompt caching 增强",
        "🔧 MiMo WebSearch 修复",
      ],
    },
    {
      version: "v1.0.0",
      date: "2026-05-28",
      changes: [
        "🎉 首个正式版本",
        "多 Agent 协作平台（顺序/层级/圆桌）",
        "支持 9+ AI 模型供应商",
        "Skills 技能市场",
        "Tauri 桌面打包（macOS）",
        "L1-L4 记忆系统",
        "Token-aware 上下文管理",
      ],
    },
  ];

  return (
    <div style={{ marginTop: 24, padding: "16px 20px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>更新日志</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg)", padding: "2px 8px", borderRadius: 4 }}>v1.3.0</span>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{expanded ? "收起" : "展开"}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {versions.map((v) => (
            <div key={v.version} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>{v.version}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.date}</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {v.changes.map((c, i) => <li key={i} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8 }}>{c}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
