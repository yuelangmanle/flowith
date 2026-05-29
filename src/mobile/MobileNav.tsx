import { useState } from "react";
import { MessageSquare, Users, Brain, Sparkles, MoreHorizontal, Bot, Code2, Settings } from "lucide-react";

type TabId = "chat" | "roundtable" | "memory" | "skills" | "agents" | "codegen" | "settings";

interface Props {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const mainTabs: { id: TabId; label: string; Icon: typeof MessageSquare }[] = [
  { id: "chat", label: "对话", Icon: MessageSquare },
  { id: "roundtable", label: "圆桌", Icon: Users },
  { id: "memory", label: "记忆", Icon: Brain },
  { id: "skills", label: "技能", Icon: Sparkles },
];

const moreTabs: { id: TabId; label: string; Icon: typeof Bot }[] = [
  { id: "agents", label: "Agent", Icon: Bot },
  { id: "codegen", label: "代码生成", Icon: Code2 },
  { id: "settings", label: "设置", Icon: Settings },
];

export function MobileNav({ active, onChange }: Props) {
  const [showMore, setShowMore] = useState(false);
  const isInMore = moreTabs.some((t) => t.id === active);

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div
          onClick={() => setShowMore(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 99,
            background: "rgba(0,0,0,0.3)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute", bottom: 68, right: 12,
              background: "var(--bg-card, #fff)", borderRadius: 12,
              border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
              overflow: "hidden", minWidth: 160,
            }}
          >
            {moreTabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => { onChange(id); setShowMore(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 16px", width: "100%", border: "none",
                  background: active === id ? "var(--primary-dim, rgba(14,165,233,0.08))" : "transparent",
                  color: active === id ? "var(--primary)" : "var(--text-primary, #0f172a)",
                  cursor: "pointer", fontSize: 13, fontWeight: active === id ? 600 : 400,
                  borderBottom: "1px solid var(--border-subtle, #f1f5f9)",
                  fontFamily: "inherit",
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom nav */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-around",
        height: 56, paddingBottom: "env(safe-area-inset-bottom)",
        background: "var(--bg-card, #fff)", borderTop: "1px solid var(--border)",
        backdropFilter: "blur(12px)",
      }}>
        {mainTabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => onChange(id)} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            padding: "6px 12px", border: "none", background: "transparent", cursor: "pointer",
            color: active === id ? "var(--primary)" : "var(--text-muted, #94a3b8)",
            fontSize: 10, fontWeight: active === id ? 600 : 400,
            transition: "color 0.2s", fontFamily: "inherit",
          }}>
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}

        {/* More button */}
        <button onClick={() => setShowMore(!showMore)} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          padding: "6px 12px", border: "none", background: "transparent", cursor: "pointer",
          color: isInMore ? "var(--primary)" : "var(--text-muted, #94a3b8)",
          fontSize: 10, fontWeight: isInMore ? 600 : 400,
          transition: "color 0.2s", position: "relative", fontFamily: "inherit",
        }}>
          <MoreHorizontal size={20} />
          <span>更多</span>
          {isInMore && (
            <div style={{
              position: "absolute", top: 2, right: 8,
              width: 6, height: 6, borderRadius: "50%",
              background: "var(--primary)",
            }} />
          )}
        </button>
      </nav>
    </>
  );
}
