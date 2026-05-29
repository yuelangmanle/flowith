import { describe, it, expect } from "vitest";
import { buildContextMessages, clearSkillsCache } from "../contextManager";
import type { ChatMessage } from "../types";

function makeMsg(role: "user" | "assistant", content: string): ChatMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

describe("contextManager", () => {
  beforeEach(() => {
    clearSkillsCache();
  });

  describe("buildContextMessages", () => {
    it("returns messages within token budget", () => {
      const messages = Array.from({ length: 50 }, (_, i) =>
        makeMsg(i % 2 === 0 ? "user" : "assistant", `Message ${i}: ${"x".repeat(200)}`)
      );

      const result = buildContextMessages({
        messages,
        systemPrompt: "You are helpful.",
        model: "gpt-4o",
        maxOutputTokens: 4096,
      });

      // Should have system + some messages
      expect(result.messages.length).toBeGreaterThan(1);
      expect(result.messages[0].role).toBe("system");
      expect(result.totalInputTokens).toBeLessThan(128_000);
    });

    it("includes system prompt with skills", () => {
      const messages = [makeMsg("user", "hello")];
      const skills = [
        { nameZh: "代码生成", descriptionZh: "帮助生成代码", capabilities: ["代码生成"] },
        { nameZh: "文档分析", descriptionZh: "分析文档内容", capabilities: ["文档分析"] },
      ];

      const result = buildContextMessages({
        messages,
        systemPrompt: "You are helpful.",
        model: "gpt-4o",
        installedSkills: skills,
        userQuery: "帮我写代码",
      });

      expect(result.systemPrompt).toContain("可用技能");
      expect(result.skillsUsed).toBeGreaterThan(0);
    });

    it("caches skills context", () => {
      const messages = [makeMsg("user", "hello")];
      const skills = [
        { nameZh: "代码生成", descriptionZh: "帮助生成代码" },
      ];

      const result1 = buildContextMessages({ messages, systemPrompt: "test", model: "gpt-4o", installedSkills: skills });
      const result2 = buildContextMessages({ messages, systemPrompt: "test", model: "gpt-4o", installedSkills: skills });

      // Should produce same result due to caching
      expect(result1.systemPrompt).toBe(result2.systemPrompt);
    });

    it("handles empty messages", () => {
      const result = buildContextMessages({
        messages: [],
        systemPrompt: "test",
        model: "gpt-4o",
      });

      expect(result.messages).toHaveLength(1); // just system
      expect(result.messages[0].role).toBe("system");
    });

    it("includes compression stats", () => {
      const messages = Array.from({ length: 20 }, (_, i) =>
        makeMsg(i % 2 === 0 ? "user" : "assistant", `Message ${i}`)
      );

      const result = buildContextMessages({
        messages,
        systemPrompt: "test",
        model: "gpt-4o",
      });

      expect(result.stats).toBeDefined();
      expect(result.stats.originalTokens).toBeGreaterThan(0);
    });

    it("uses specifiedSkill in system prompt", () => {
      const messages = [makeMsg("user", "写代码")];
      const skills = [
        { nameZh: "代码生成", descriptionZh: "帮助生成代码" },
      ];

      const result = buildContextMessages({
        messages,
        systemPrompt: "test",
        model: "gpt-4o",
        installedSkills: skills,
        specifiedSkill: "代码生成",
      });

      expect(result.systemPrompt).toContain("指定技能");
    });
  });
});
