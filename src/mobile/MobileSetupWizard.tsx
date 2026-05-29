import { useState } from "react";
import { useStore } from "../lib/store";
import { apiFetch } from "../lib/shared";

const STEPS = [
  { id: "welcome", title: "欢迎" },
  { id: "provider", title: "选择供应商" },
  { id: "apikey", title: "配置密钥" },
  { id: "done", title: "完成" },
];

const PROVIDERS = [
  { id: "deepseek", name: "DeepSeek", icon: "DS", desc: "国产高性能模型，性价比极高", free: false, placeholder: "sk-..." },
  { id: "xiaomi-mimo", name: "小米 MiMo", icon: "MI", desc: "小米大模型，支持联网搜索", free: false, placeholder: "输入 MiMo API Key" },
  { id: "ollama", name: "Ollama (本地)", icon: "OL", desc: "本地运行开源模型，完全免费", free: true, placeholder: "" },
  { id: "openai", name: "OpenAI", icon: "AI", desc: "GPT-4o 等全球领先模型", free: false, placeholder: "sk-..." },
  { id: "qwen", name: "通义千问", icon: "QN", desc: "阿里云大模型，中文能力强", free: false, placeholder: "sk-..." },
];

interface Props {
  onComplete: () => void;
}

export function MobileSetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | "">("");
  const { providers, setProviders, syncProvidersToServer } = useStore();

  const currentStep = STEPS[step];

  const handleTest = async () => {
    if (!selectedProvider) return;
    setTesting(true); setTestResult("");
    try {
      const updated = providers.map((p) =>
        p.id === selectedProvider ? { ...p, apiKey, enabled: true } : p
      );
      setProviders(updated);
      const resp = await apiFetch("/api/test-provider", {
        method: "POST",
        body: JSON.stringify({ providerId: selectedProvider }),
      });
      const result = (await resp.json()) as { ok: boolean };
      setTestResult(result.ok ? "ok" : "fail");
      if (result.ok) syncProvidersToServer();
    } catch { setTestResult("fail"); }
    setTesting(false);
  };

  const handleFinish = () => {
    syncProvidersToServer();
    localStorage.setItem("flowith-setup-done", "true");
    onComplete();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 50%, #f43f5e 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font)",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.96)", borderRadius: 20,
        padding: "32px 28px", maxWidth: 420, width: "92%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)", color: "#1e1b4b",
      }}>
        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= step ? "#0ea5e9" : "#e5e7eb",
              transition: "background 0.3s",
            }} />
          ))}
        </div>

        {/* Welcome */}
        {currentStep.id === "welcome" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🌊</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>欢迎使用 Flowith</h2>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28, lineHeight: 1.6 }}>
              多 AI Agent 协作工作平台<br />
              支持多种模型、圆桌讨论、代码生成
            </p>
            <button onClick={() => setStep(1)} style={primaryBtn}>开始配置</button>
          </div>
        )}

        {/* Provider selection */}
        {currentStep.id === "provider" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>选择模型供应商</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>选择一个你想使用的 AI 模型供应商</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, maxHeight: 300, overflow: "auto" }}>
              {PROVIDERS.map((p) => (
                <button key={p.id} onClick={() => setSelectedProvider(p.id)} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  borderRadius: 12, border: `2px solid ${selectedProvider === p.id ? "#0ea5e9" : "#e5e7eb"}`,
                  background: selectedProvider === p.id ? "#f0f9ff" : "#fff",
                  cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                }}>
                  <span style={{ fontSize: 24, width: 32, textAlign: "center" }}>{p.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{p.desc}</div>
                  </div>
                  {p.free && <span style={{ fontSize: 10, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 8 }}>免费</span>}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep(0)} style={{ ...primaryBtn, background: "#f3f4f6", color: "#374151", flex: 1 }}>上一步</button>
              <button onClick={() => setStep(2)} disabled={!selectedProvider} style={{ ...primaryBtn, flex: 1, opacity: selectedProvider ? 1 : 0.5 }}>下一步</button>
            </div>
          </div>
        )}

        {/* API Key */}
        {currentStep.id === "apikey" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>配置 API Key</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
              {PROVIDERS.find((p) => p.id === selectedProvider)?.free
                ? "Ollama 无需 API Key，确保本地已安装并运行"
                : `输入你的 ${PROVIDERS.find((p) => p.id === selectedProvider)?.name} API Key`}
            </p>
            {!PROVIDERS.find((p) => p.id === selectedProvider)?.free && (
              <input
                type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                placeholder={PROVIDERS.find((p) => p.id === selectedProvider)?.placeholder}
                style={{
                  width: "100%", padding: "12px 14px", borderRadius: 10,
                  border: "2px solid #e5e7eb", fontSize: 14, marginBottom: 16,
                  outline: "none", boxSizing: "border-box",
                }}
              />
            )}
            <button onClick={handleTest} disabled={testing} style={{
              ...primaryBtn, width: "100%", marginBottom: 16,
              background: testResult === "ok" ? "#16a34a" : testResult === "fail" ? "#dc2626" : "#0ea5e9",
            }}>
              {testing ? "测试中..." : testResult === "ok" ? "连接成功 ✓" : testResult === "fail" ? "连接失败，点击重试" : "测试连接"}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep(1)} style={{ ...primaryBtn, background: "#f3f4f6", color: "#374151", flex: 1 }}>上一步</button>
              <button onClick={() => setStep(3)} style={{ ...primaryBtn, flex: 1 }}>跳过</button>
            </div>
          </div>
        )}

        {/* Done */}
        {currentStep.id === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>配置完成！</h2>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28, lineHeight: 1.6 }}>
              你随时可以在设置中修改配置<br />开始探索 Flowith 的强大功能吧
            </p>
            <button onClick={handleFinish} style={{ ...primaryBtn, fontSize: 16, padding: "14px 32px" }}>
              开始使用 Flowith
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "12px 24px", borderRadius: 10, border: "none",
  background: "#0ea5e9", color: "#fff", fontSize: 14,
  fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
  fontFamily: "inherit",
};
