import { MessageSquare, Users, Brain, Settings, Sparkles } from "lucide-react";

type TabId = "chat" | "roundtable" | "memory" | "skills" | "settings";

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; Icon: typeof MessageSquare }[] = [
  { id: "chat", label: "对话", Icon: MessageSquare },
  { id: "roundtable", label: "圆桌", Icon: Users },
  { id: "memory", label: "记忆", Icon: Brain },
  { id: "skills", label: "技能", Icon: Sparkles },
  { id: "settings", label: "设置", Icon: Settings },
];

export function MobileNav({ active, onChange }: Props) {
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "space-around",
      height: 56, paddingBottom: "env(safe-area-inset-bottom)",
      background: "var(--bg-card, #fff)", borderTop: "1px solid var(--border)",
      backdropFilter: "blur(12px)",
    }}>
      {tabs.map(({ id, label, Icon }) => (
        <button key={id} onClick={() => onChange(id)} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          padding: "6px 12px", border: "none", background: "transparent", cursor: "pointer",
          color: active === id ? "var(--primary)" : "var(--text-muted)",
          fontSize: 10, fontWeight: active === id ? 600 : 400,
          transition: "color 0.2s",
        }}>
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
