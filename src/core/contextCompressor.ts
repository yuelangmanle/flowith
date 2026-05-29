// ─── Context Compression Engine ────────────────────────────────
// Multi-layer compression pipeline for chat message history.
// L1: Media stripping (zero loss)
// L2: Redundancy cleaning (zero loss)
// L3: Progressive truncation (minor loss, controlled)
// L4: Semantic compression (LLM-based, optional)

import type { ChatMessage, CompressionStats, ProviderConfig } from "./types";
import { estimateTokens, estimateBase64ImageTokens } from "./tokenCounter";
import { streamChatCompletion } from "./modelGateway";

// ─── Compression Options ───────────────────────────────────────

export interface CompressionOptions {
  imageRetentionRounds?: number;   // default 2
  fileRetentionRounds?: number;    // default 3
  truncationStartRound?: number;   // default 3
  enableSemanticCompression?: boolean; // default true
  semanticThreshold?: number;      // % of context window to trigger L4, default 0.6
  compressionModel?: { provider: ProviderConfig; model: string };
  currentTurnIndex?: number;       // index of the latest user message
}

// ─── Main Compression Pipeline ─────────────────────────────────

export async function compressContext(
  messages: ChatMessage[],
  options: CompressionOptions = {}
): Promise<{ compressed: ChatMessage[]; stats: CompressionStats }> {
  const {
    imageRetentionRounds = 2,
    fileRetentionRounds = 3,
    truncationStartRound = 3,
    enableSemanticCompression = true,
    semanticThreshold = 0.6,
    compressionModel,
    currentTurnIndex,
  } = options;

  if (messages.length === 0) {
    return {
      compressed: [],
      stats: {
        originalTokens: 0,
        compressedTokens: 0,
        savedTokens: 0,
        compressionRatio: 1,
        imagesStripped: 0,
        filesStripped: 0,
        messagesTruncated: 0,
        summariesCreated: 0,
      },
    };
  }

  const originalTokens = countTotalTokens(messages);
  let working = messages.map((m) => ({ ...m })); // shallow clone
  let imagesStripped = 0;
  let filesStripped = 0;
  let messagesTruncated = 0;
  let summariesCreated = 0;

  // Determine the "current round" — the index of the most recent user message
  const latestIdx = currentTurnIndex ?? (working.length - 1);

  // ── L1: Media Stripping ──────────────────────────────────────
  for (let i = 0; i < working.length; i++) {
    const roundsBack = latestIdx - i;
    if (roundsBack > imageRetentionRounds) {
      // Strip images from old messages
      const imgCount = countImages(working[i]);
      if (imgCount > 0) {
        working[i] = stripImages(working[i]);
        imagesStripped += imgCount;
      }
    }
    if (roundsBack > fileRetentionRounds) {
      // Strip file content from old messages
      const fileCount = working[i].attachedFiles?.length ?? 0;
      if (fileCount > 0) {
        working[i] = stripFileContent(working[i]);
        filesStripped += fileCount;
      }
    }
  }

  // ── L2: Redundancy Cleaning ──────────────────────────────────
  for (let i = 0; i < working.length; i++) {
    const roundsBack = latestIdx - i;
    if (roundsBack > 0) {
      const cleaned = cleanRedundancy(working[i], roundsBack > 2);
      if (cleaned.content !== working[i].content) {
        working[i] = cleaned;
      }
    }
  }

  // ── L3: Progressive Truncation ───────────────────────────────
  for (let i = 0; i < working.length; i++) {
    const roundsBack = latestIdx - i;
    if (roundsBack >= truncationStartRound && working[i].role === "assistant") {
      const truncated = progressiveTruncate(working[i], roundsBack);
      if (truncated.content !== working[i].content) {
        working[i] = truncated;
        messagesTruncated++;
      }
    }
  }

  // ── L4: Semantic Compression (optional, async) ───────────────
  if (enableSemanticCompression && compressionModel) {
    const currentTokens = countTotalTokens(working);
    // We'll estimate context window from the model name
    const contextWindow = estimateContextWindow(compressionModel.model);
    if (currentTokens > contextWindow * semanticThreshold) {
      const result = await semanticCompress(
        working,
        latestIdx,
        truncationStartRound,
        compressionModel
      );
      working = result.messages;
      summariesCreated += result.summariesCreated;
    }
  }

  const compressedTokens = countTotalTokens(working);
  const savedTokens = originalTokens - compressedTokens;

  return {
    compressed: working,
    stats: {
      originalTokens,
      compressedTokens,
      savedTokens: Math.max(0, savedTokens),
      compressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
      imagesStripped,
      filesStripped,
      messagesTruncated,
      summariesCreated,
    },
  };
}

// ─── L1 Helpers ────────────────────────────────────────────────

function countImages(msg: ChatMessage): number {
  let count = 0;
  if (msg.imageData) count++;
  if (msg.additionalImages) count += msg.additionalImages.length;
  return count;
}

function stripImages(msg: ChatMessage): ChatMessage {
  const imgCount = countImages(msg);
  if (imgCount === 0) return msg;
  return {
    ...msg,
    imageData: undefined,
    additionalImages: undefined,
    content: msg.content + `\n[图片已移除，共 ${imgCount} 张]`,
  };
}

function stripFileContent(msg: ChatMessage): ChatMessage {
  if (!msg.attachedFiles || msg.attachedFiles.length === 0) return msg;
  const fileNames = msg.attachedFiles.map((f) => f.name).join(", ");
  return {
    ...msg,
    attachedFiles: msg.attachedFiles.map((f) => ({
      name: f.name,
      type: f.type,
      size: f.size,
      // content removed
    })),
    content: msg.content + `\n[文件: ${fileNames}]`,
  };
}

// ─── L2 Helpers ────────────────────────────────────────────────

function cleanRedundancy(msg: ChatMessage, stripThinking: boolean): ChatMessage {
  let content = msg.content;

  // Collapse 3+ consecutive empty lines to 2
  content = content.replace(/\n{4,}/g, "\n\n\n");

  // Strip thinking/reasoning blocks from old messages
  if (stripThinking) {
    content = content.replace(/<think>[\s\S]*?<\/think>/g, "");
    content = content.replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, "");
    content = content.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
  }

  // Deduplicate consecutive identical paragraphs (200+ chars)
  const paragraphs = content.split(/\n\n+/);
  const deduped: string[] = [];
  for (const p of paragraphs) {
    if (p.length >= 200 && deduped.length > 0 && deduped[deduped.length - 1] === p) {
      continue; // skip duplicate
    }
    deduped.push(p);
  }
  content = deduped.join("\n\n");

  return { ...msg, content };
}

// ─── L3 Helpers ────────────────────────────────────────────────

function progressiveTruncate(msg: ChatMessage, roundsBack: number): ChatMessage {
  let maxChars: number;
  let keepChars: number;

  if (roundsBack < 5) {
    maxChars = 2000;
    keepChars = 1500;
  } else if (roundsBack < 10) {
    maxChars = 1000;
    keepChars = 800;
  } else {
    maxChars = 500;
    keepChars = 400;
  }

  if (msg.content.length <= maxChars) return msg;

  // Try to truncate at a sentence/paragraph boundary
  let cutPoint = keepChars;
  const newlineIdx = msg.content.lastIndexOf("\n", keepChars);
  const periodIdx = msg.content.lastIndexOf("。", keepChars);
  const periodEnIdx = msg.content.lastIndexOf(". ", keepChars);
  cutPoint = Math.max(newlineIdx, periodIdx, periodEnIdx, keepChars - 200);
  if (cutPoint < keepChars * 0.5) cutPoint = keepChars;

  // Also truncate code blocks in old messages
  let truncated = msg.content.slice(0, cutPoint);
  truncated = truncateCodeBlocks(truncated, roundsBack);

  return {
    ...msg,
    content: truncated + `\n[...已截断，原文 ${msg.content.length} 字符]`,
  };
}

function truncateCodeBlocks(text: string, roundsBack: number): string {
  if (roundsBack < 3) return text;
  const maxLines = roundsBack < 5 ? 30 : 15;

  return text.replace(/```[\s\S]*?```/g, (match) => {
    const lines = match.split("\n");
    if (lines.length <= maxLines + 2) return match; // +2 for opening/closing ```
    const kept = lines.slice(0, maxLines + 1); // keep opening line + maxLines
    kept.push(`[...代码已截断，共 ${lines.length - 2} 行]`);
    kept.push("```");
    return kept.join("\n");
  });
}

// ─── L4: Semantic Compression ──────────────────────────────────

async function semanticCompress(
  messages: ChatMessage[],
  latestIdx: number,
  truncationStartRound: number,
  model: { provider: ProviderConfig; model: string }
): Promise<{ messages: ChatMessage[]; summariesCreated: number }> {
  // Find message groups from rounds back that can be summarized
  // Group consecutive user+assistant pairs from the older portion
  const compressibleStart = Math.max(0, latestIdx - 10);
  const compressibleEnd = Math.max(0, latestIdx - truncationStartRound);

  if (compressibleStart >= compressibleEnd) {
    return { messages, summariesCreated: 0 };
  }

  const compressibleRange = messages.slice(compressibleStart, compressibleEnd);
  if (compressibleRange.length < 2) {
    return { messages, summariesCreated: 0 };
  }

  // Group into chunks of 2-4 messages
  const groups: ChatMessage[][] = [];
  for (let i = 0; i < compressibleRange.length; i += 3) {
    const group = compressibleRange.slice(i, Math.min(i + 3, compressibleRange.length));
    if (group.length >= 2) groups.push(group);
  }

  if (groups.length === 0) {
    return { messages, summariesCreated: 0 };
  }

  let summariesCreated = 0;
  const result = [...messages];

  for (const group of groups) {
    const groupText = group
      .map((m) => `[${m.role === "user" ? "用户" : m.agentName ?? "AI"}]: ${m.content.slice(0, 500)}`)
      .join("\n");

    // Skip if group is already short
    if (groupText.length < 200) continue;

    try {
      const summaryMessages = [
        {
          role: "user" as const,
          content: `请用 100 字以内概括以下对话的关键信息和结论：\n\n${groupText}`,
        },
      ];

      let summary = "";
      for await (const chunk of streamChatCompletion({
        provider: model.provider,
        model: model.model,
        messages: summaryMessages,
        stream: true,
        maxTokens: 200,
      })) {
        if (chunk.type === "text" && chunk.content) {
          summary += chunk.content;
        }
      }

      if (summary) {
        const firstIdx = compressibleStart + groups.indexOf(group) * 3;
        // Replace the first message in the group with a summary
        const summaryMsg: ChatMessage = {
          id: `summary-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: "assistant",
          content: `[历史摘要]: ${summary.trim()}`,
          createdAt: new Date().toISOString(),
        };
        // Mark original messages for removal by replacing content
        for (const orig of group) {
          const origIdx = result.findIndex((m) => m.id === orig.id);
          if (origIdx >= 0) {
            result[origIdx] = { ...result[origIdx], content: "__COMPRESSED__" };
          }
        }
        // Insert summary at the position of the first message
        const insertIdx = result.findIndex((m) => m.id === group[0].id);
        if (insertIdx >= 0) {
          result[insertIdx] = summaryMsg;
        }
        summariesCreated++;
      }
    } catch {
      // If L4 fails, just skip — L1-L3 already applied
    }
  }

  // Remove messages marked as compressed
  const filtered = result.filter((m) => m.content !== "__COMPRESSED__");

  return { messages: filtered, summariesCreated };
}

// ─── Utility ───────────────────────────────────────────────────

function countTotalTokens(messages: ChatMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content) + 4; // role overhead
    if (msg.imageData) total += estimateBase64ImageTokens(msg.imageData);
    if (msg.additionalImages) {
      for (const img of msg.additionalImages) {
        total += estimateBase64ImageTokens(img);
      }
    }
    if (msg.attachedFiles) {
      for (const f of msg.attachedFiles) {
        if (f.content) total += estimateTokens(f.content);
      }
    }
  }
  return total;
}

function estimateContextWindow(model: string): number {
  const lower = model.toLowerCase();
  if (lower.includes("gpt-4o") || lower.includes("gpt-4.1")) return 128_000;
  if (lower.includes("o3") || lower.includes("o4")) return 200_000;
  if (lower.includes("claude")) return 200_000;
  if (lower.includes("deepseek")) return 64_000;
  if (lower.includes("qwen")) return 131_072;
  if (lower.includes("gemini")) return 1_048_576;
  return 8_192;
}

/** Synchronous version of compressContext for L1-L3 only (no L4 semantic) */
export function compressContextSync(
  messages: ChatMessage[],
  options: Omit<CompressionOptions, "enableSemanticCompression" | "compressionModel"> = {}
): { compressed: ChatMessage[]; stats: CompressionStats } {
  const {
    imageRetentionRounds = 2,
    fileRetentionRounds = 3,
    truncationStartRound = 3,
    currentTurnIndex,
  } = options;

  if (messages.length === 0) {
    return {
      compressed: [],
      stats: {
        originalTokens: 0,
        compressedTokens: 0,
        savedTokens: 0,
        compressionRatio: 1,
        imagesStripped: 0,
        filesStripped: 0,
        messagesTruncated: 0,
        summariesCreated: 0,
      },
    };
  }

  const originalTokens = countTotalTokens(messages);
  let working = messages.map((m) => ({ ...m }));
  let imagesStripped = 0;
  let filesStripped = 0;
  let messagesTruncated = 0;

  const latestIdx = currentTurnIndex ?? (working.length - 1);

  // L1
  for (let i = 0; i < working.length; i++) {
    const roundsBack = latestIdx - i;
    if (roundsBack > imageRetentionRounds) {
      const imgCount = countImages(working[i]);
      if (imgCount > 0) {
        working[i] = stripImages(working[i]);
        imagesStripped += imgCount;
      }
    }
    if (roundsBack > fileRetentionRounds) {
      const fileCount = working[i].attachedFiles?.length ?? 0;
      if (fileCount > 0) {
        working[i] = stripFileContent(working[i]);
        filesStripped += fileCount;
      }
    }
  }

  // L2
  for (let i = 0; i < working.length; i++) {
    const roundsBack = latestIdx - i;
    if (roundsBack > 0) {
      working[i] = cleanRedundancy(working[i], roundsBack > 2);
    }
  }

  // L3
  for (let i = 0; i < working.length; i++) {
    const roundsBack = latestIdx - i;
    if (roundsBack >= truncationStartRound && working[i].role === "assistant") {
      const truncated = progressiveTruncate(working[i], roundsBack);
      if (truncated.content !== working[i].content) {
        working[i] = truncated;
        messagesTruncated++;
      }
    }
  }

  const compressedTokens = countTotalTokens(working);

  return {
    compressed: working,
    stats: {
      originalTokens,
      compressedTokens,
      savedTokens: Math.max(0, originalTokens - compressedTokens),
      compressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
      imagesStripped,
      filesStripped,
      messagesTruncated,
      summariesCreated: 0,
    },
  };
}
