import { useState } from "react";
import { Brain, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  content: string;
  defaultExpanded?: boolean;
}

export function ThinkingBlock({ content, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Clean up fragmented thinking text (2-3 chars per line from streaming)
  const cleanedContent = (() => {
    const lines = content.split("\n");
    if (lines.length > 3) {
      const avgLen = lines.reduce((sum, l) => sum + l.trim().length, 0) / lines.length;
      if (avgLen < 20) {
        // Short lines - likely fragmented streaming output, join into paragraphs
        const joined = lines.map(l => l.trim()).filter(Boolean).join("");
        // Re-wrap at ~80 chars for readability
        const result: string[] = [];
        let current = "";
        for (const ch of joined) {
          current += ch;
          if (current.length >= 80 && /[,，。.!！?？;；\s]/.test(ch)) {
            result.push(current);
            current = "";
          }
        }
        if (current) result.push(current);
        return result.join("\n");
      }
    }
    return content;
  })();
  const charCount = cleanedContent.length;

  return (
    <div style={{
      marginBottom: 8, borderRadius: 8,
      border: "1px solid var(--border)", overflow: "hidden",
      background: "var(--bg-secondary)",
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 6, width: "100%",
          padding: "8px 12px", background: "transparent", border: "none",
          cursor: "pointer", fontSize: 12, color: "var(--text-secondary)", fontWeight: 500,
          transition: "background 0.15s",
        }}
      >
        <Brain size={14} style={{ color: "var(--violet, #8b5cf6)", flexShrink: 0 }} />
        <span>深度思考</span>
        <span style={{ opacity: 0.5, fontSize: 11 }}>
          ({charCount > 1000 ? `${(charCount / 1000).toFixed(1)}k` : charCount} 字)
        </span>
        <span style={{ marginLeft: "auto", opacity: 0.5 }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>
      {expanded && (
        <div style={{
          padding: "8px 12px", whiteSpace: "pre-wrap", fontSize: 12,
          lineHeight: 1.7, color: "var(--text-secondary)",
          borderTop: "1px solid var(--border)",
          maxHeight: 500, overflow: "auto",
          fontFamily: "var(--font)",
        }}>
          {cleanedContent}
        </div>
      )}
    </div>
  );
}
