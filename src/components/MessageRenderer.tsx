import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, Check, ZoomIn } from "lucide-react";
import { CodeBlock } from "./CodeBlock";
import { ThinkingBlock } from "./ThinkingBlock";
import { ImageLightbox } from "./ImageLightbox";
import type { ChatMessage } from "../core/types";

interface Props {
  content: string;
  msgId: string;
  imageData?: string;
  additionalImages?: string[];
  attachedFiles?: ChatMessage["attachedFiles"];
  /** Character count threshold for auto-collapse. Default 2000. */
  collapseThreshold?: number;
  /** Max chars to show when collapsed. Default 800. */
  collapseMaxChars?: number;
  isUser?: boolean;
}

/**
 * Shared message content renderer used by both desktop and mobile views.
 * Handles: thinking blocks, code blocks, inline code, long-message collapse,
 * image display with lightbox, file attachments.
 */
export function MessageRenderer({
  content, msgId, imageData, additionalImages, attachedFiles,
  collapseThreshold = 2000, collapseMaxChars = 800, isUser = false,
}: Props) {
  const [expandedLong, setExpandedLong] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [copiedImage, setCopiedImage] = useState(false);

  // ─── 1. Extract thinking blocks ──────────────────────────────
  let processedContent = content;
  processedContent = processedContent.replace(/\[思考\]([\s\S]*?)\[\/思考\]/g, "<think>$1</think>");

  // First pass: merge adjacent <think> blocks (streaming sends many small blocks)
  processedContent = processedContent.replace(/<\/think>\s*<think>>/g, "\n");

  const thinkingParts = processedContent.split(/(<think>[\s\S]*?<\/think>)/g);
  const thinkingBlocks: string[] = [];
  const textParts: string[] = [];

  for (const part of thinkingParts) {
    const thinkMatch = part.match(/^<think>([\s\S]*?)<\/think>$/);
    if (thinkMatch) {
      thinkingBlocks.push(thinkMatch[1].trim());
    } else if (part.trim()) {
      textParts.push(part);
    }
  }

  const thinkingText = thinkingBlocks.join("\n");
  const mainContent = textParts.join("").trim();
  const isLong = mainContent.length > collapseThreshold;

  // ─── 2. Parse code blocks and inline code ─────────────────────
  const renderTextContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      const codeMatch = part.match(/^```(\w*)\n?([\s\S]*?)```$/);
      if (codeMatch) {
        return <CodeBlock key={i} code={codeMatch[2].trim()} language={codeMatch[1] || undefined} />;
      }
      // Inline code
      const inlineParts = part.split(/(`[^`]+`)/g);
      return (
        <span key={i}>
          {inlineParts.map((ip, j) => {
            const inlineMatch = ip.match(/^`(.+)`$/);
            if (inlineMatch) {
              return (
                <code key={j} style={{
                  padding: "1px 5px", borderRadius: 4,
                  background: "var(--bg, #f1f5f9)",
                  border: "1px solid var(--border, #e2e8f0)",
                  fontSize: "0.9em", fontFamily: "var(--font-mono, monospace)",
                }}>
                  {inlineMatch[1]}
                </code>
              );
            }
            return <span key={j}>{ip}</span>;
          })}
        </span>
      );
    });
  };

  // ─── 3. Render ────────────────────────────────────────────────
  const showContent = isLong && !expandedLong
    ? mainContent.slice(0, collapseMaxChars)
    : mainContent;

  return (
    <div>
      {/* Images */}
      {imageData && (
        <div style={{ marginBottom: 6, position: "relative", display: "inline-block" }}>
          <img
            src={imageData}
            alt="附件"
            onClick={() => setPreviewImage(imageData)}
            style={{
              maxWidth: "100%", maxHeight: 240, borderRadius: 8,
              cursor: "zoom-in", objectFit: "cover",
              border: "1px solid var(--border)",
            }}
          />
          <button
            onClick={() => setPreviewImage(imageData)}
            style={{
              position: "absolute", bottom: 6, right: 6,
              background: "rgba(0,0,0,0.5)", border: "none", borderRadius: 6,
              padding: "3px 6px", color: "white", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 3, fontSize: 10,
            }}
          >
            <ZoomIn size={12} /> 查看原图
          </button>
        </div>
      )}
      {additionalImages && additionalImages.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          {additionalImages.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`附件 ${idx + 2}`}
              onClick={() => setPreviewImage(img)}
              style={{
                maxWidth: 120, maxHeight: 80, borderRadius: 6,
                cursor: "zoom-in", objectFit: "cover",
                border: "1px solid var(--border)",
              }}
            />
          ))}
        </div>
      )}

      {/* File attachments */}
      {attachedFiles && attachedFiles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 6 }}>
          {attachedFiles.map((f, idx) => (
            <div key={idx} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 8px", borderRadius: 6,
              background: "var(--bg, #f1f5f9)", fontSize: 11,
              color: "var(--text-muted, #94a3b8)",
            }}>
              <span>📎</span>
              <span style={{ fontWeight: 500 }}>{f.name}</span>
              <span>{(f.size / 1024).toFixed(1)} KB</span>
            </div>
          ))}
        </div>
      )}

      {/* Thinking block */}
      {thinkingText && <ThinkingBlock content={thinkingText} />}

      {/* Main content */}
      {isLong && !expandedLong ? (
        <div>
          <div style={{
            whiteSpace: "pre-wrap", maxHeight: 400, overflow: "hidden",
            position: "relative",
          }}>
            {renderTextContent(showContent)}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
              background: isUser
                ? "linear-gradient(transparent, var(--primary, #0ea5e9))"
                : "linear-gradient(transparent, var(--bg-card, #ffffff))",
            }} />
          </div>
          <button
            onClick={() => setExpandedLong(true)}
            style={{
              display: "flex", alignItems: "center", gap: 3,
              padding: "4px 0", border: "none", background: "transparent",
              color: "var(--primary, #0ea5e9)", cursor: "pointer", fontSize: 12,
              marginTop: 4,
            }}
          >
            <ChevronDown size={14} /> 展开全文 ({mainContent.length} 字)
          </button>
        </div>
      ) : (
        <div>
          <div style={{ whiteSpace: "pre-wrap" }}>{renderTextContent(mainContent)}</div>
          {isLong && expandedLong && (
            <button
              onClick={() => setExpandedLong(false)}
              style={{
                display: "flex", alignItems: "center", gap: 3,
                padding: "4px 0", border: "none", background: "transparent",
                color: "var(--primary, #0ea5e9)", cursor: "pointer", fontSize: 12,
                marginTop: 4,
              }}
            >
              <ChevronUp size={14} /> 收起
            </button>
          )}
        </div>
      )}

      {/* Lightbox */}
      <ImageLightbox src={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
