import { useState } from "react";
import { Brain, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  content: string;
  defaultExpanded?: boolean;
}

export function ThinkingBlock({ content, defaultExpanded = false }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Clean up fragmented thinking text (streaming sends tiny chunks)
  const cleanedContent = (() => {
    // Normalize line endings
    let text = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    // Remove <think>/ closing tags that leaked through
    text = text.replace(/<\/think>/g, "").replace(/<think>/g, "");
    
    const lines = text.split("\n");
    // Always attempt cleanup if we have many short lines (fragmented streaming)
    const nonEmpty = lines.filter(l => l.trim().length > 0);
    if (nonEmpty.length > 2) {
      const avgLen = nonEmpty.reduce((sum, l) => sum + l.trim().length, 0) / nonEmpty.length;
      if (avgLen < 30) {
        // Fragmented output - join all text and re-wrap
        const joined = nonEmpty.map(l => l.trim()).join("");
        if (joined.length === 0) return "";
        // Re-wrap at ~80 chars, breaking at sentence/clause boundaries
        const result: string[] = [];
        let current = "";
        for (const ch of joined) {
          current += ch;
          if (current.length >= 60 && /[，。！？；：,.!?;:\s]/.test(ch)) {
            result.push(current.trim());
            current = "";
          }
        }
        if (current.trim()) result.push(current.trim());
        return result.join("\n");
      }
    }
    return text;
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
