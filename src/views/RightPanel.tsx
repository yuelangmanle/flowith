import { Activity, Users, Zap } from "lucide-react";
import { useStore } from "../lib/store";
import { getProviderIcon } from "../lib/shared";
import { appMetadata } from "../core/demoData";

export function RightPanel() {
  const { rightTab, setRightTab, agents, providers, models, conversations } = useStore();

  return (
    <div className="right-panel">
      <div className="right-panel-tabs">
        <button className={rightTab === "agents" ? "active" : ""} onClick={() => setRightTab("agents")}><Users size={12} /> Agents</button>
        <button className={rightTab === "models" ? "active" : ""} onClick={() => setRightTab("models")}><Zap size={12} /> 模型</button>
        <button className={rightTab === "info" ? "active" : ""} onClick={() => setRightTab("info")}><Activity size={12} /> 信息</button>
      </div>
      <div className="right-panel-content">
        {rightTab === "agents" && agents.map((a) => (
          <div key={a.id} className="agent-card">
            <div className="a-avatar" style={{ background: a.color }}>{a.avatar}</div>
            <div className="a-info"><div className="a-name">{a.name}</div><div className="a-goal">{a.goal?.slice(0, 40)}</div></div>
          </div>
        ))}
        {rightTab === "models" && providers.filter((p) => p.enabled).map((p) => (
          <div key={p.id} className="provider-group">
            <div className="provider-group-title">{getProviderIcon(p.type)} {p.name}</div>
            {models.filter((m) => m.providerId === p.id).slice(0, 8).map((m) => (
              <div key={m.id} className="model-card">
                <div className="m-name">{m.id}</div>
                <div className="m-caps">{m.capabilities.reasoning && "推理 "}{m.capabilities.fast && "快速 "}{m.capabilities.vision && "视觉 "}{m.capabilities.local && "本地"}</div>
              </div>
            ))}
          </div>
        ))}
        {rightTab === "info" && (
          <div>
            <h4 style={{ fontSize: 13, marginBottom: 8 }}>平台信息</h4>
            <dl style={{ fontSize: 13 }}>
              <dt style={{ color: "var(--text-muted)" }}>版本</dt><dd>{appMetadata.version}</dd>
              <dt style={{ color: "var(--text-muted)" }}>供应商</dt><dd>{providers.length}</dd>
              <dt style={{ color: "var(--text-muted)" }}>已启用</dt><dd>{providers.filter((p) => p.enabled).length}</dd>
              <dt style={{ color: "var(--text-muted)" }}>Agents</dt><dd>{agents.length}</dd>
              <dt style={{ color: "var(--text-muted)" }}>对话</dt><dd>{conversations.length}</dd>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}
