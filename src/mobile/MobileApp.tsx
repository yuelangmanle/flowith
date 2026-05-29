import { useState, useEffect } from "react";
import { MobileNav } from "./MobileNav";
import { MobileChatView } from "./MobileChatView";
import { MobileRoundtableView } from "./MobileRoundtableView";
import { MobileMemoryView } from "./MobileMemoryView";
import { MobileSkillsView } from "./MobileSkillsView";
import { MobileAgentsView } from "./MobileAgentsView";
import { MobileCodeGenView } from "./MobileCodeGenView";
import { MobileSettingsView } from "./MobileSettingsView";
import { MobileSetupWizard } from "./MobileSetupWizard";
import { useStore } from "../lib/store";
import { apiFetch } from "../lib/shared";
import { bootstrapMobile } from "../lib/mobileBootstrap";
import type { Skill } from "../core/types";

type TabId = "chat" | "roundtable" | "memory" | "skills" | "agents" | "codegen" | "settings";

export function MobileApp() {
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const store = useStore();

  useEffect(() => {
    // Check if first run
    const setupDone = localStorage.getItem("flowith-setup-done");
    if (!setupDone) {
      setShowSetup(true);
    }

    // Bootstrap mobile adapter and load data
    bootstrapMobile().then(async () => {
      // Parallel data loading
      const loadTasks = [
        { key: "agents", path: "/api/agents", setter: store.setAgents },
        { key: "providers", path: "/api/providers", setter: store.setProviders },
        { key: "conversations", path: "/api/conversations", setter: store.setConversations },
      ];

      await Promise.allSettled(
        loadTasks.map(async ({ path, setter }) => {
          try {
            const resp = await apiFetch(path);
            if (resp.ok) {
              const data = await resp.json();
              if (Array.isArray(data) && data.length > 0) {
                (setter as (v: unknown) => void)(data);
              }
            }
          } catch {}
        })
      );

      // Load skills separately (different type)
      try {
        const sResp = await apiFetch("/api/skills");
        if (sResp.ok) {
          const data = (await sResp.json()) as Skill[];
          if (Array.isArray(data)) store.setSkills(data);
        }
      } catch {}

      // Load TTS providers
      try {
        const tResp = await apiFetch("/api/tts-providers");
        if (tResp.ok) {
          const data = await tResp.json();
          if (Array.isArray(data) && data.length > 0) store.setTTSProviders(data);
        }
      } catch {}

      store.setServerConnected(true);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  // Loading screen
  if (loading) {
    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "var(--bg-primary)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌊</div>
        <div style={{
          fontSize: 20, fontWeight: 700, color: "var(--text-primary)",
          marginBottom: 8,
        }}>Flowith</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>加载中...</div>
        <div style={{
          width: 40, height: 40, border: "3px solid var(--border)",
          borderTop: "3px solid var(--primary)", borderRadius: "50%",
          animation: "spin 0.8s linear infinite", marginTop: 20,
        }} />
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
      {/* Setup wizard */}
      {showSetup && <MobileSetupWizard onComplete={() => setShowSetup(false)} />}

      {/* Main content */}
      <div style={{ flex: 1, overflow: "hidden", paddingBottom: 56 }}>
        {activeTab === "chat" && <MobileChatView />}
        {activeTab === "roundtable" && <MobileRoundtableView />}
        {activeTab === "memory" && <MobileMemoryView />}
        {activeTab === "skills" && <MobileSkillsView />}
        {activeTab === "agents" && <MobileAgentsView />}
        {activeTab === "codegen" && <MobileCodeGenView />}
        {activeTab === "settings" && <MobileSettingsView />}
      </div>

      {/* Bottom nav */}
      <MobileNav active={activeTab} onChange={setActiveTab} />
    </div>
  );
}
