import { useState, useEffect, useCallback } from "react";
import {
  Moon, Sun, Volume2, VolumeX, RefreshCw, ChevronDown, ChevronRight,
  ShieldCheck, Zap, Loader2, TestTube, Search,
} from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, getProviderIcon } from "../lib/shared";
import { saveProviders } from "../core/persistence";
import type { ProviderConfig, TTSProviderConfig, ModelConfig } from "../core/types";

// ─── Provider Card ──────────────────────────────────────────────

function ProviderCard({
  provider, expanded, onToggle, onUpdate, models, onDiscover, discovering,
}: {
  provider: ProviderConfig;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (updater: (p: ProviderConfig) => ProviderConfig) => void;
  models: ModelConfig[];
  onDiscover: () => void;
  discovering: boolean;
}) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | "">("");

  const handleTest = async () => {
    setTesting(true); setTestResult("");
    try {
      const resp = await apiFetch("/api/test-provider", {
        method: "POST",
        body: JSON.stringify({ providerId: provider.id }),
      });
      const result = (await resp.json()) as { ok: boolean };
      setTestResult(result.ok ? "ok" : "fail");
    } catch { setTestResult("fail"); }
    setTesting(false);
  };

  const provModels = models.filter((m) => m.providerId === provider.id);

  return (
    <div style={{
      borderRadius: 12, border: "1px solid var(--border)",
      background: "var(--bg-card)", overflow: "hidden",
      marginBottom: 8,
    }}>
      <button onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "12px 14px", border: "none", background: "transparent",
        cursor: "pointer", textAlign: "left",
      }}>
        <span style={{ fontSize: 18, width: 28, textAlign: "center" }}>{getProviderIcon(provider.type)}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{provider.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {provider.apiKey ? "已配置" : provider.type === "ollama" ? "本地运行" : "未配置"}
            {provModels.length > 0 && ` · ${provModels.length} 模型`}
          </div>
        </div>
        <span style={{
          padding: "2px 8px", borderRadius: 10, fontSize: 10, fontWeight: 600,
          background: provider.enabled ? "rgba(16,185,129,0.1)" : "rgba(148,163,184,0.1)",
          color: provider.enabled ? "#10b981" : "#94a3b8",
        }}>
          {provider.enabled ? "启用" : "禁用"}
        </span>
        {expanded ? <ChevronDown size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />}
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--border)" }}>
          {/* Enable/Disable */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <span style={{ fontSize: 13, color: "var(--text-primary)" }}>启用</span>
            <button onClick={() => onUpdate((p) => ({ ...p, enabled: !p.enabled }))} style={{
              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
              background: provider.enabled ? "var(--primary)" : "var(--bg-active)",
              position: "relative", transition: "background 0.2s",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", background: "#fff",
                position: "absolute", top: 2, left: provider.enabled ? 22 : 2,
                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
          </div>

          {/* API Key */}
          {provider.type !== "ollama" && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>API Key</label>
              <input
                type="password"
                value={provider.apiKey}
                onChange={(e) => onUpdate((p) => ({ ...p, apiKey: e.target.value }))}
                placeholder="sk-..."
                style={inputStyle}
              />
            </div>
          )}

          {/* Base URL */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>
              Base URL {provider.altBaseUrl && "(主)"}
            </label>
            <input
              value={provider.baseUrl}
              onChange={(e) => onUpdate((p) => ({ ...p, baseUrl: e.target.value }))}
              style={inputStyle}
            />
          </div>

          {/* Alt URL (MiMo) */}
          {provider.altBaseUrl !== undefined && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>备用 URL</label>
              <input
                value={provider.altBaseUrl}
                onChange={(e) => onUpdate((p) => ({ ...p, altBaseUrl: e.target.value }))}
                style={inputStyle}
              />
            </div>
          )}

          {/* MiMo Web Search */}
          {provider.type === "xiaomi-mimo" && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Search size={14} style={{ color: "var(--text-muted)" }} />
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>联网搜索</span>
              </div>
              <button onClick={() => onUpdate((p) => ({ ...p, webSearchEnabled: !p.webSearchEnabled }))} style={{
                width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                background: provider.webSearchEnabled ? "var(--primary)" : "var(--bg-active)",
                position: "relative",
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 2, left: provider.webSearchEnabled ? 22 : 2,
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </button>
            </div>
          )}

          {/* DeepSeek Reasoning Effort */}
          {provider.type === "deepseek" && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>思考力度</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(["low", "medium", "high"] as const).map((level) => (
                  <button key={level} onClick={() => onUpdate((p) => ({ ...p, reasoningEffort: level }))} style={{
                    flex: 1, padding: "6px", borderRadius: 8, border: "1px solid var(--border)",
                    background: provider.reasoningEffort === level ? "var(--primary)" : "var(--bg-card)",
                    color: provider.reasoningEffort === level ? "#fff" : "var(--text-secondary)",
                    fontSize: 12, cursor: "pointer", fontWeight: provider.reasoningEffort === level ? 600 : 400,
                  }}>
                    {level === "low" ? "低" : level === "medium" ? "中" : "高"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Qwen Settings */}
          {provider.type === "qwen" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>联网搜索</span>
                <button onClick={() => onUpdate((p) => ({ ...p, enableSearch: !p.enableSearch }))} style={{
                  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: provider.enableSearch ? "var(--primary)" : "var(--bg-active)",
                  position: "relative",
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", background: "#fff",
                    position: "absolute", top: 2, left: provider.enableSearch ? 22 : 2,
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>深度思考</span>
                <button onClick={() => onUpdate((p) => ({ ...p, enableThinking: !p.enableThinking }))} style={{
                  width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                  background: provider.enableThinking ? "var(--primary)" : "var(--bg-active)",
                  position: "relative",
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", background: "#fff",
                    position: "absolute", top: 2, left: provider.enableThinking ? 22 : 2,
                    transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </button>
              </div>
            </>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button onClick={handleTest} disabled={testing} style={btnStyle("var(--bg-secondary)")}>
              {testing ? <Loader2 size={13} className="spin" /> : <TestTube size={13} />}
              {testing ? "测试中..." : testResult === "ok" ? "✓ 成功" : testResult === "fail" ? "✗ 失败" : "测试连接"}
            </button>
            {provider.supportsModelList && (
              <button onClick={onDiscover} disabled={discovering} style={btnStyle("var(--primary)")}>
                {discovering ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
                {discovering ? "发现中..." : `发现模型 (${provModels.length})`}
              </button>
            )}
          </div>

          {/* Discovered models */}
          {provModels.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>已发现模型：</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {provModels.slice(0, 20).map((m) => (
                  <span key={m.id} style={{
                    padding: "2px 8px", borderRadius: 6, fontSize: 10,
                    background: "var(--bg-secondary)", color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}>
                    {m.id}
                    {m.capabilities.reasoning ? " 🧠" : ""}
                    {m.capabilities.vision ? " 👁" : ""}
                    {m.capabilities.fast ? " ⚡" : ""}
                  </span>
                ))}
                {provModels.length > 20 && (
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>+{provModels.length - 20} 更多</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TTS Provider Card ──────────────────────────────────────────

function TTSCard({
  provider, expanded, onToggle, onUpdate,
}: {
  provider: TTSProviderConfig;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (updater: (p: TTSProviderConfig) => TTSProviderConfig) => void;
}) {
  const [testing, setTesting] = useState(false);
  const showToast = useStore((s) => s.showToast);

  const ttsIcons: Record<string, string> = {
    "mimo-tts": "🎙️", "openai-tts": "🔊", "edge-tts": "🌐",
    "fish-audio": "🐟", "custom-tts": "⚙️",
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const resp = await apiFetch("/api/tts", {
        method: "POST",
        body: JSON.stringify({ text: "你好，这是语音合成测试。", ttsProviderId: provider.id }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { audioBase64: string; format: string };
        const bytes = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: `audio/${data.format}` }));
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
        showToast("TTS 测试成功", "success");
      } else {
        const err = (await resp.json()) as { error: string };
        showToast(`TTS 测试失败: ${err.error}`, "error");
      }
    } catch (err) {
      showToast(`TTS 错误: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
    setTesting(false);
  };

  return (
    <div style={{
      borderRadius: 12, border: "1px solid var(--border)",
      background: "var(--bg-card)", overflow: "hidden", marginBottom: 8,
    }}>
      <button onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "12px 14px", border: "none", background: "transparent",
        cursor: "pointer", textAlign: "left",
      }}>
        <span style={{ fontSize: 18 }}>{ttsIcons[provider.type] ?? "🔊"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{provider.name}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {provider.apiKey || provider.type === "edge-tts" ? "已配置" : "未配置"}
            {provider.defaultVoice && ` · ${provider.defaultVoice}`}
          </div>
        </div>
        {expanded ? <ChevronDown size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />}
      </button>

      {expanded && (
        <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--border)" }}>
          {/* Enable */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <span style={{ fontSize: 13 }}>启用</span>
            <button onClick={() => onUpdate((p) => ({ ...p, enabled: !p.enabled }))} style={{
              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
              background: provider.enabled ? "var(--primary)" : "var(--bg-active)",
              position: "relative",
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", background: "#fff",
                position: "absolute", top: 2, left: provider.enabled ? 22 : 2,
                transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
          </div>

          {/* API Key */}
          {provider.type !== "edge-tts" && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>API Key</label>
              <input type="password" value={provider.apiKey} onChange={(e) => onUpdate((p) => ({ ...p, apiKey: e.target.value }))} style={inputStyle} />
            </div>
          )}

          {/* Base URL */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>Base URL</label>
            <input value={provider.baseUrl} onChange={(e) => onUpdate((p) => ({ ...p, baseUrl: e.target.value }))} style={inputStyle} />
          </div>

          {/* Voice */}
          {provider.type === "mimo-tts" && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>默认音色</label>
              <select value={provider.defaultVoice ?? ""} onChange={(e) => onUpdate((p) => ({ ...p, defaultVoice: e.target.value }))} style={{ ...inputStyle, width: "100%" }}>
                <option value="">默认</option>
                <option value="冰糖">冰糖 ♀</option>
                <option value="茉莉">茉莉 ♀</option>
                <option value="苏打">苏打 ♂</option>
                <option value="白桦">白桦 ♂</option>
                <option value="Mia">Mia EN</option>
              </select>
            </div>
          )}

          {/* Speed */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>
              语速: {provider.defaultSpeed ?? 1.0}x
            </label>
            <input
              type="range" min={0.5} max={2.0} step={0.25}
              value={provider.defaultSpeed ?? 1.0}
              onChange={(e) => onUpdate((p) => ({ ...p, defaultSpeed: parseFloat(e.target.value) }))}
              style={{ width: "100%" }}
            />
          </div>

          {/* Format */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>输出格式</label>
            <select value={provider.defaultFormat ?? "wav"} onChange={(e) => onUpdate((p) => ({ ...p, defaultFormat: e.target.value as "wav" | "mp3" | "pcm16" }))} style={{ ...inputStyle, width: "100%" }}>
              <option value="wav">WAV (无损)</option>
              <option value="mp3">MP3 (压缩)</option>
              <option value="pcm16">PCM16 (原始)</option>
            </select>
          </div>

          <button onClick={handleTest} disabled={testing} style={btnStyle("var(--primary)")}>
            {testing ? <Loader2 size={13} className="spin" /> : <Volume2 size={13} />}
            {testing ? "测试中..." : "测试 TTS"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Settings View ─────────────────────────────────────────

export function MobileSettingsView() {
  const {
    providers, setProviders, models, setModels, showToast,
    ttsProviders, setTTSProviders, syncTTSProvidersToServer,
    ttsEnabled, setTtsEnabled, darkMode, toggleDarkMode,
    selectedProviderId, setSelectedProviderId, selectedModelId, setSelectedModelId,
    syncProvidersToServer, tokenUsageByConv,
  } = useStore();

  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [expandedTTS, setExpandedTTS] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);

  const enabledProviders = providers.filter((p) => p.enabled);

  const updateProvider = (id: string, updater: (p: ProviderConfig) => ProviderConfig) => {
    const newProviders = providers.map((p) => (p.id === id ? updater(p) : p));
    setProviders(newProviders);
    saveProviders(newProviders);
    syncProvidersToServer();
  };

  const updateTTSProvider = (id: string, updater: (p: TTSProviderConfig) => TTSProviderConfig) => {
    const newProviders = ttsProviders.map((p) => (p.id === id ? updater(p) : p));
    setTTSProviders(newProviders);
    syncTTSProvidersToServer();
  };

  const handleDiscover = async (providerId: string) => {
    setDiscovering(providerId);
    try {
      const resp = await apiFetch(`/api/discover/${providerId}`, { method: "POST" });
      if (resp.ok) {
        const data = (await resp.json()) as { models: ModelConfig[] };
        setModels((prev) => {
          const existing = new Set(prev.filter((m) => m.providerId === providerId).map((m) => m.id));
          const newModels = data.models.filter((m) => !existing.has(m.id));
          return [...prev.filter((m) => m.providerId !== providerId), ...data.models];
        });
        showToast(`发现 ${data.models.length} 个模型`, "success");
      } else {
        showToast("模型发现失败", "error");
      }
    } catch {
      showToast("模型发现失败", "error");
    }
    setDiscovering(null);
  };

  // Aggregate token stats
  const totalStats = Object.values(tokenUsageByConv).reduce(
    (acc, s) => ({
      prompt: acc.prompt + s.promptTokens,
      completion: acc.completion + s.completionTokens,
      cached: acc.cached + s.cachedTokens,
      saved: acc.saved + s.compressionSaved,
    }),
    { prompt: 0, completion: 0, cached: 0, saved: 0 }
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>设置</h2>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {/* ─── Global Settings ─── */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>⚙️ 全局设置</h3>

          {/* Default model */}
          <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)", padding: 14, marginBottom: 8 }}>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>默认供应商</label>
              <select
                value={selectedProviderId}
                onChange={(e) => {
                  setSelectedProviderId(e.target.value);
                  const pm = models.filter((m) => m.providerId === e.target.value);
                  if (pm.length > 0) setSelectedModelId(pm[0].id);
                }}
                style={{ ...inputStyle, width: "100%" }}
              >
                <option value="">未设置</option>
                {enabledProviders.map((p) => (
                  <option key={p.id} value={p.id}>{getProviderIcon(p.type)} {p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4, display: "block" }}>默认模型</label>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              >
                {!selectedProviderId && <option value="">请先选择供应商</option>}
                {selectedProviderId && models.filter((m) => m.providerId === selectedProviderId).length === 0 && <option value="">暂无模型，请先发现</option>}
                {models.filter((m) => m.providerId === selectedProviderId).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id} {m.capabilities.reasoning ? " [思考]" : ""}{m.capabilities.vision ? " [视觉]" : ""}{m.capabilities.fast ? " [快]" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Dark mode */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {darkMode ? <Moon size={16} style={{ color: "var(--text-primary)" }} /> : <Sun size={16} style={{ color: "var(--text-primary)" }} />}
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>深色模式</span>
              </div>
              <button onClick={toggleDarkMode} style={{
                width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                background: darkMode ? "var(--primary)" : "var(--bg-active)",
                position: "relative",
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 2, left: darkMode ? 22 : 2,
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </button>
            </div>

            {/* Global TTS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {ttsEnabled ? <Volume2 size={16} style={{ color: "var(--primary)" }} /> : <VolumeX size={16} style={{ color: "var(--text-muted)" }} />}
                <span style={{ fontSize: 13, color: "var(--text-primary)" }}>全局语音朗读</span>
              </div>
              <button onClick={() => setTtsEnabled(!ttsEnabled)} style={{
                width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
                background: ttsEnabled ? "var(--primary)" : "var(--bg-active)",
                position: "relative",
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 2, left: ttsEnabled ? 22 : 2,
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </button>
            </div>
          </div>
        </div>

        {/* ─── Token Stats ─── */}
        {(totalStats.prompt > 0 || totalStats.completion > 0) && (
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>📊 Token 用量</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <StatCard label="输入 Tokens" value={totalStats.prompt.toLocaleString()} color="var(--primary)" />
              <StatCard label="输出 Tokens" value={totalStats.completion.toLocaleString()} color="var(--accent, #f43f5e)" />
              {totalStats.cached > 0 && <StatCard label="缓存命中" value={totalStats.cached.toLocaleString()} color="var(--emerald, #10b981)" />}
              {totalStats.saved > 0 && <StatCard label="压缩节省" value={totalStats.saved.toLocaleString()} color="var(--violet, #8b5cf6)" />}
            </div>
          </div>
        )}

        {/* ─── Model Providers ─── */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>🤖 模型供应商</h3>
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              expanded={expandedProvider === p.id}
              onToggle={() => setExpandedProvider(expandedProvider === p.id ? null : p.id)}
              onUpdate={(updater) => updateProvider(p.id, updater)}
              models={models}
              onDiscover={() => handleDiscover(p.id)}
              discovering={discovering === p.id}
            />
          ))}
        </div>

        {/* ─── TTS Providers ─── */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 10 }}>🔊 语音合成</h3>
          {ttsProviders.map((tp) => (
            <TTSCard
              key={tp.id}
              provider={tp}
              expanded={expandedTTS === tp.id}
              onToggle={() => setExpandedTTS(expandedTTS === tp.id ? null : tp.id)}
              onUpdate={(updater) => updateTTSProvider(tp.id, updater)}
            />
          ))}
        </div>

        {/* ─── Changelog ─── */}
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowChangelog(!showChangelog)} style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)",
            background: "var(--bg-card)", cursor: "pointer", textAlign: "left",
          }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>更新日志</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-secondary)", padding: "2px 8px", borderRadius: 4, marginLeft: "auto" }}>v1.3.0</span>
            {showChangelog ? <ChevronDown size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />}
          </button>
          {showChangelog && (
            <div style={{ marginTop: 8, padding: 14, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg-card)" }}>
              {changelog.map((v) => (
                <div key={v.version} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>{v.version}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.date}</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {v.changes.map((c, i) => (
                      <li key={i} style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8 }}>{c}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 10,
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ─── Data ───────────────────────────────────────────────────────

const changelog = [
  {
    version: "v1.3.0",
    date: "2026-05-29",
    changes: [
      "📱 安卓端完整重做：所有功能对标桌面端",
      "💬 对话：markdown 渲染、代码高亮、思考过程、图片上传压缩、文件附件",
      "🎯 消息操作：复制、重新生成、删除、分支对话",
      "🔍 对话列表：搜索、置顶、删除",
      "⚙️ 完整设置：供应商配置、TTS 配置、模型发现、连接测试",
      "🧠 完整记忆管理：L1-L4 层、搜索、添加、批量删除、整合、导出导入",
      "🛠 技能市场：搜索、分类、GitHub 安装、本地导入",
      "🤖 Agent 管理：创建、删除、Per-Agent 模型/TTS 配置",
      "⚡ 代码生成：6 阶段流程、流式输出、快速模板",
      "🎉 首次引导：SetupWizard 新用户配置",
      "🧩 共享渲染组件提取：MessageRenderer、CodeBlock、ThinkingBlock、ImageLightbox",
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
    version: "v1.2.0",
    date: "2026-05-29",
    changes: [
      "📱 安卓端 Capacitor 打包",
      "🔄 API 适配层 + IndexedDB 持久化",
      "📦 CI 自动构建 APK",
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

// ─── Styles ─────────────────────────────────────────────────────

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
  border: "1px solid var(--border)",
  background: bg,
  color: bg === "var(--primary)" ? "#fff" : "var(--text-primary)",
  cursor: "pointer", fontSize: 12, fontWeight: 500,
});
