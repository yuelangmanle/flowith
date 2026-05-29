import { useState, useEffect } from "react";
import { MobileNav } from "./MobileNav";
import { MobileChatView } from "./MobileChatView";
import { MobileRoundtableView } from "./MobileRoundtableView";
import { useStore } from "../lib/store";
import { apiFetch } from "../lib/shared";
import { bootstrapMobile } from "../lib/mobileBootstrap";
import type { ModelConfig, Skill, TTSProviderConfig, AgentTTSConfig } from "../core/types";

type TabId = "chat" | "roundtable" | "memory" | "skills" | "settings";

function MobileMemoryView() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>记忆</h2>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16, color: "var(--text-muted)", fontSize: 13, textAlign: "center", paddingTop: 60 }}>
        记忆管理功能开发中...
      </div>
    </div>
  );
}

function MobileSkillsView() {
  const { skills } = useStore();
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>技能</h2>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {skills.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", paddingTop: 60 }}>暂无已安装技能</div>
        ) : (
          skills.map((s) => (
            <div key={s.id} style={{ padding: 12, marginBottom: 8, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{(s as any).nameZh ?? s.name}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{(s as any).descriptionZh ?? s.description}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MobileSettingsView() {
  const { providers, setProviders, showToast, darkMode, toggleDarkMode } = useStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>设置</h2>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>模型供应商</h3>
          {providers.filter((p) => p.enabled).map((p) => (
            <div key={p.id} style={{ padding: 12, marginBottom: 8, borderRadius: 12, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{p.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.apiKey ? "已配置" : "未配置 API Key"}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>外观</h3>
          <button onClick={toggleDarkMode} style={{
            padding: "10px 16px", borderRadius: 12, border: "1px solid var(--border)",
            background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer", width: "100%", textAlign: "left",
          }}>{darkMode ? "深色模式" : "浅色模式"}</button>
        </div>
      </div>
    </div>
  );
}

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const store = useStore();

  useEffect(() => {
    // Bootstrap mobile adapter
    bootstrapMobile().then(async () => {
      // Load data from mobile storage
      try {
        const aResp = await apiFetch("/api/agents");
        if (aResp.ok) { const d = await aResp.json(); if (Array.isArray(d) && d.length > 0) store.setAgents(d); }
      } catch {}

      try {
        const pResp = await apiFetch("/api/providers");
        if (pResp.ok) { const d = await pResp.json(); if (Array.isArray(d) && d.length > 0) store.setProviders(d); }
      } catch {}

      try {
        const sResp = await apiFetch("/api/skills");
        if (sResp.ok) { const d = await sResp.json() as Skill[]; if (Array.isArray(d)) store.setSkills(d); }
      } catch {}

      store.setServerConnected(true);
    });
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
      <div style={{ flex: 1, overflow: "hidden", paddingBottom: 56 }}>
        {activeTab === "chat" && <MobileChatView />}
        {activeTab === "roundtable" && <MobileRoundtableView />}
        {activeTab === "memory" && <MobileMemoryView />}
        {activeTab === "skills" && <MobileSkillsView />}
        {activeTab === "settings" && <MobileSettingsView />}
      </div>
      <MobileNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
