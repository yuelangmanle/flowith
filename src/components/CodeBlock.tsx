import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface Props {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  // Simple syntax highlighting with keyword coloring
  const highlightCode = (raw: string, lang: string): React.ReactNode[] => {
    if (!lang || ["text", "plain", "markdown", "md"].includes(lang.toLowerCase())) {
      return [raw];
    }
    const lines = raw.split("\n");
    return lines.map((line, lineIdx) => {
      const tokens: React.ReactNode[] = [];
      // Comment detection
      const commentIdx = line.search(/(\/\/|#|--|\/\*)/);
      let mainPart = line;
      let commentPart = "";
      if (commentIdx > 0 && !line.trim().startsWith("//") && !line.trim().startsWith("#")) {
        // Only split if comment is not at start
      }
      if (commentIdx === 0 || line.trim().startsWith("//") || line.trim().startsWith("#") || line.trim().startsWith("--")) {
        tokens.push(<span key={`${lineIdx}-c`} style={{ color: "#6a9955", fontStyle: "italic" }}>{line}</span>);
        return lineIdx < lines.length - 1 ? [...tokens, "\n"] : tokens;
      }
      // String highlighting
      const parts = line.split(/(["'`][^"'`]*["'`])/g);
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (/^["'`]/.test(part)) {
          tokens.push(<span key={`${lineIdx}-s${i}`} style={{ color: "#ce9178" }}>{part}</span>);
        } else {
          // Keyword highlighting
          const kwParts = part.split(/\b(import|export|from|const|let|var|function|return|if|else|for|while|class|interface|type|extends|implements|async|await|new|this|try|catch|throw|switch|case|break|default|typeof|instanceof|void|null|undefined|true|false|def|print|with|as|in|not|and|or|is|lambda|yield|raise|except|finally|pass|elif|match|case)\b/g);
          for (let j = 0; j < kwParts.length; j++) {
            if (/^(import|export|from|const|let|var|function|return|if|else|for|while|class|interface|type|extends|implements|async|await|new|this|try|catch|throw|switch|case|break|default|typeof|instanceof|void|null|undefined|true|false|def|print|with|as|in|not|and|or|is|lambda|yield|raise|except|finally|pass|elif|match)$/.test(kwParts[j])) {
              tokens.push(<span key={`${lineIdx}-k${j}`} style={{ color: "#569cd6" }}>{kwParts[j]}</span>);
            } else {
              tokens.push(<span key={`${lineIdx}-t${j}`}>{kwParts[j]}</span>);
            }
          }
        }
      }
      return lineIdx < lines.length - 1 ? [...tokens, "\n"] : tokens;
    });
  };

  return (
    <div style={{
      position: "relative", margin: "6px 0", borderRadius: 8,
      background: "#1e1e2e", border: "1px solid var(--border)",
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "4px 10px", borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}>
        <span style={{ fontSize: 11, color: "#888" }}>{language || "code"}</span>
        <button
          onClick={handleCopy}
          style={{
            display: "flex", alignItems: "center", gap: 3, padding: "2px 6px",
            border: "none", background: "transparent", color: copied ? "#6BCB77" : "#aaa",
            cursor: "pointer", fontSize: 11, borderRadius: 4,
          }}
          title="复制代码"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          <span>{copied ? "已复制" : "复制"}</span>
        </button>
      </div>
      <pre style={{
        margin: 0, padding: "10px 12px", overflow: "auto",
        fontSize: 12, lineHeight: 1.5, color: "#e4e4e7",
        fontFamily: "var(--font-mono, monospace)",
        whiteSpace: "pre", wordBreak: "normal",
      }}>
        <code>{highlightCode(code, language || "")}</code>
      </pre>
    </div>
  );
}
