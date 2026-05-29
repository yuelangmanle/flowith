import { describe, it, expect } from "vitest";
import { compressContextSync } from "../contextCompressor";
import type { ChatMessage } from "../types";

function makeMsg(role: "user" | "assistant", content: string, opts: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    ...opts,
  };
}

describe("contextCompressor", () => {
  describe("L1 — Media Stripping", () => {
    it("strips images from old messages", () => {
      const messages: ChatMessage[] = [
        makeMsg("user", "看这张图", { imageData: "data:image/png;base64," + "A".repeat(10000) }),
        makeMsg("assistant", "好的"),
        makeMsg("user", "第二张图", { imageData: "data:image/png;base64," + "B".repeat(10000) }),
        makeMsg("assistant", "看到了"),
        makeMsg("user", "第三张图", { imageData: "data:image/png;base64," + "C".repeat(10000) }),
        makeMsg("assistant", "收到"),
        makeMsg("user", "最新消息"),
      ];

      const { compressed, stats } = compressContextSync(messages, { imageRetentionRounds: 2 });

      // Latest messages should retain images
      expect(compressed[4].imageData).toBeDefined(); // 3rd image, 2 rounds back
      expect(compressed[6].content).toBe("最新消息");

      // Older messages should have images stripped
      expect(compressed[0].imageData).toBeUndefined();
      expect(compressed[0].content).toContain("[图片已移除");
      expect(stats.imagesStripped).toBeGreaterThan(0);
    });

    it("strips file content from old messages", () => {
      const messages: ChatMessage[] = [
        makeMsg("user", "分析这个文件", {
          attachedFiles: [{ name: "test.pdf", type: "pdf", size: 1000, content: "很长的文件内容..." }],
        }),
        makeMsg("assistant", "分析结果"),
        makeMsg("user", "再看看"),
        makeMsg("assistant", "好的"),
        makeMsg("user", "最新"),
      ];

      const { compressed, stats } = compressContextSync(messages, { fileRetentionRounds: 2 });

      // Old file content should be stripped
      expect(compressed[0].attachedFiles?.[0].content).toBeUndefined();
      expect(compressed[0].content).toContain("[文件:");
      expect(stats.filesStripped).toBeGreaterThan(0);
    });
  });

  describe("L2 — Redundancy Cleaning", () => {
    it("collapses excessive empty lines", () => {
      const messages: ChatMessage[] = [
        makeMsg("user", "hello"),
        makeMsg("assistant", "line1\n\n\n\n\n\n\nline2"),
        makeMsg("user", "follow up"),
      ];

      const { compressed } = compressContextSync(messages);
      expect(compressed[1].content).not.toContain("\n\n\n\n\n");
    });

    it("strips thinking blocks from old messages", () => {
      const messages: ChatMessage[] = [
        makeMsg("assistant", "<think>thinking about this...</think>actual answer"),
        makeMsg("user", "follow up"),
        makeMsg("assistant", "<think>more thinking</think>response"),
        makeMsg("user", "latest"),
      ];

      const { compressed } = compressContextSync(messages);
      // Old messages (2+ rounds back) should have thinking stripped
      expect(compressed[0].content).not.toContain("<think>");
      expect(compressed[0].content).toContain("actual answer");
    });
  });

  describe("L3 — Progressive Truncation", () => {
    it("truncates long assistant messages from old rounds", () => {
      const longContent = "A".repeat(5000);
      const messages: ChatMessage[] = [
        makeMsg("user", "问题"),
        makeMsg("assistant", longContent),
        makeMsg("user", "追问"),
        makeMsg("assistant", "短回复"),
        makeMsg("user", "最新"),
      ];

      const { compressed, stats } = compressContextSync(messages, { truncationStartRound: 3 });

      // Long old message should be truncated
      expect(compressed[1].content.length).toBeLessThan(longContent.length);
      expect(compressed[1].content).toContain("已截断");
      expect(stats.messagesTruncated).toBeGreaterThan(0);
    });

    it("does not truncate user messages", () => {
      const longUserMsg = "U".repeat(5000);
      const messages: ChatMessage[] = [
        makeMsg("user", longUserMsg),
        makeMsg("assistant", "回复"),
        makeMsg("user", "最新"),
      ];

      const { compressed } = compressContextSync(messages, { truncationStartRound: 2 });
      expect(compressed[0].content).toBe(longUserMsg);
    });
  });

  describe("CompressionStats", () => {
    it("reports correct stats", () => {
      const messages: ChatMessage[] = [
        makeMsg("user", "hello"),
        makeMsg("assistant", "hi there"),
      ];

      const { stats } = compressContextSync(messages);
      expect(stats.originalTokens).toBeGreaterThan(0);
      expect(stats.compressedTokens).toBeGreaterThan(0);
      expect(stats.compressionRatio).toBeGreaterThan(0);
      expect(stats.compressionRatio).toBeLessThanOrEqual(1);
    });

    it("handles empty messages", () => {
      const { compressed, stats } = compressContextSync([]);
      expect(compressed).toHaveLength(0);
      expect(stats.originalTokens).toBe(0);
      expect(stats.compressionRatio).toBe(1);
    });
  });
});
