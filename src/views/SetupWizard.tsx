import { useState } from "react";
import { useStore } from "../lib/store";
import { apiFetch } from "../lib/shared";

const STEPS = [
  { id: "welcome", title: "欢迎使用 Flowith" },
  { id: "provider", title: "选择模型供应商" },
  { id: "apikey", title: "配置 API Key" },
  { id: "done", title: "开始使用" },
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

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | "">("");
  const { providers, setProviders, syncProvidersToServer } = useStore();

  const currentStep = STEPS[step];

  const handleTestConnection = async () => {
    if (!selectedProvider) return;
    setTesting(true);
    setTestResult("");
    try {
      // Update provider config
      const updated = providers.map((p) => {
        if (p.id === selectedProvider) {
          return { ...p, apiKey, enabled: true };
        }
        return p;
      });
      setProviders(updated);

      // Test connection
      const resp = await apiFetch("/api/test-provider", {
        method: "POST",
        body: JSON.stringify({ providerId: selectedProvider }),
      });
      const result = await resp.json() as { ok: boolean };
      setTestResult(result.ok ? "ok" : "fail");

      if (result.ok) {
        syncProvidersToServer();
      }
    } catch {
      setTestResult("fail");
    }
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
      background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{
        background: "rgba(255,255,255,0.95)", borderRadius: 20, padding: "40px 48px",
        maxWidth: 520, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        color: "#1e1b4b",
      }}>
        {/* Progress */}
        <div style={{ display: "flex", gap: 6, marginBottom: 32 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i <= step ? "#6366f1" : "#e5e7eb",
              transition: "background 0.3s",
            }} />
          ))}
        </div>

        {/* Step Content */}
        {currentStep.id === "welcome" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>&#127758;</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>欢迎使用 Flowith</h2>
            <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 32, lineHeight: 1.6 }}>
              多 AI Agent 协作工作平台<br />
              支持多种模型、圆桌讨论、代码生成
            </p>
            <button onClick={() => setStep(1)} style={btnStyle}>开始配置</button>
          </div>
        )}

        {currentStep.id === "provider" && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>选择模型供应商</h2>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>选择一个你想使用的 AI 模型供应商</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              {PROVIDERS.map((p) => (
                <button key={p.id} onClick={() => setSelectedProvider(p.id)} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                  borderRadius: 12, border: `2px solid ${selectedProvider === p.id ? "#6366f1" : "#e5e7eb"}`,
                  background: selectedProvider === p.id ? "#eef2ff" : "#fff",
                  cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                }}>
                  <span style={{ fontSize: 28 }}>{p.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>{p.desc}</div>
                  </div>
                  {p.free && <span style={{ marginLeft: "auto", fontSize: 11, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: 8 }}>免费</span>}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(0)} style={{ ...btnStyle, background: "#f3f4f6", color: "#374151" }}>上一步</button>
              <button onClick={() => setStep(2)} disabled={!selectedProvider} style={{ ...btnStyle, opacity: selectedProvider ? 1 : 0.5 }}>下一步</button>
            </div>
          </div>
        )}

        {currentStep.id === "apikey" && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>配置 API Key</h2>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
              {PROVIDERS.find(p => p.id === selectedProvider)?.free
                ? "Ollama 无需 API Key，确保本地已安装并运行"
                : `输入你的 ${PROVIDERS.find(p => p.id === selectedProvider)?.name} API Key`}
            </p>

            {!PROVIDERS.find(p => p.id === selectedProvider)?.free && (
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={PROVIDERS.find(p => p.id === selectedProvider)?.placeholder}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 10,
                  border: "2px solid #e5e7eb", fontSize: 15, marginBottom: 16,
                  outline: "none", transition: "border-color 0.2s",
                }}
                onFocus={(e) => e.target.style.borderColor = "#6366f1"}
                onBlur={(e) => e.target.style.borderColor = "#e5e7eb"}
              />
            )}

            <button onClick={handleTestConnection} disabled={testing} style={{
              ...btnStyle, width: "100%", marginBottom: 16,
              background: testResult === "ok" ? "#16a34a" : testResult === "fail" ? "#dc2626" : "#6366f1",
            }}>
              {testing ? "测试中..." : testResult === "ok" ? "连接成功 &#10003;" : testResult === "fail" ? "连接失败，点击重试" : "测试连接"}
            </button>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ ...btnStyle, background: "#f3f4f6", color: "#374151" }}>上一步</button>
              <button onClick={() => setStep(3)} style={btnStyle}>跳过，稍后配置</button>
            </div>
          </div>
        )}

        {currentStep.id === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>&#127881;</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>配置完成！</h2>
            <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 32, lineHeight: 1.6 }}>
              你随时可以在设置中修改模型配置<br />
              开始探索 Flowith 的强大功能吧
            </p>
            <button onClick={handleFinish} style={{ ...btnStyle, fontSize: 18, padding: "16px 40px" }}>
              开始使用 Flowith
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 10,
  border: "none",
  background: "#6366f1",
  color: "#fff",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s",
  flex: 1,
};
