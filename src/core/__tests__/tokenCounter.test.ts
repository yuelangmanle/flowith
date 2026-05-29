import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  estimateMessagesTokens,
  estimateImageTokens,
  estimateBase64ImageTokens,
  hashString,
} from "../tokenCounter";

describe("tokenCounter", () => {
  describe("estimateTokens", () => {
    it("returns 0 for empty string", () => {
      expect(estimateTokens("")).toBe(0);
    });

    it("estimates English text correctly", () => {
      // "Hello world" = 2 words ≈ 0.5 tokens from words, but also has non-space chars
      const tokens = estimateTokens("Hello world");
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(10);
    });

    it("estimates Chinese text correctly", () => {
      // 4 Chinese chars ≈ 6 tokens (1.5 per char)
      const tokens = estimateTokens("你好世界");
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(20);
    });

    it("estimates mixed Chinese/English text", () => {
      const tokens = estimateTokens("Hello 你好 World 世界");
      expect(tokens).toBeGreaterThan(0);
    });

    it("gives higher token count for Chinese than same-length English", () => {
      const eng = estimateTokens("abcd"); // 4 English chars
      const chn = estimateTokens("你好世界"); // 4 Chinese chars
      expect(chn).toBeGreaterThan(eng);
    });
  });

  describe("estimateMessagesTokens", () => {
    it("includes role overhead", () => {
      const single = estimateTokens("test");
      const messages = estimateMessagesTokens([{ role: "user", content: "test" }]);
      expect(messages).toBeGreaterThanOrEqual(single + 4);
    });

    it("handles multiple messages", () => {
      const tokens = estimateMessagesTokens([
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ]);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe("estimateImageTokens", () => {
    it("returns 85 for low-res", () => {
      expect(estimateImageTokens(512, 512, "low")).toBe(85);
    });

    it("returns higher for high-res", () => {
      const tokens = estimateImageTokens(1024, 1024, "high");
      expect(tokens).toBeGreaterThan(85);
      // 2x2 tiles * 170 + 85 = 765
      expect(tokens).toBe(765);
    });
  });

  describe("estimateBase64ImageTokens", () => {
    it("returns 0 for empty string", () => {
      expect(estimateBase64ImageTokens("")).toBe(0);
    });

    it("returns 85 for small images", () => {
      // Small base64 (< 50KB decoded)
      const small = "data:image/png;base64," + "A".repeat(1000);
      expect(estimateBase64ImageTokens(small)).toBe(85);
    });
  });

  describe("hashString", () => {
    it("returns consistent hash for same input", () => {
      expect(hashString("hello")).toBe(hashString("hello"));
    });

    it("returns different hash for different input", () => {
      expect(hashString("hello")).not.toBe(hashString("world"));
    });

    it("returns a non-empty string", () => {
      expect(hashString("test").length).toBeGreaterThan(0);
    });
  });
});
