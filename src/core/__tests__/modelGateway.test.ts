import { describe, expect, it } from "vitest";
import {
  createDefaultProviders,
  discoverModels,
  getFallbackModels,
  mergeDiscoveredModels,
} from "../modelGateway";
import type { ProviderConfig } from "../types";

describe("model gateway", () => {
  it("defines all MVP provider types with required config fields", () => {
    const providers = createDefaultProviders();
    expect(providers.map((provider) => provider.type)).toEqual([
      "openai",
      "anthropic",
      "gemini",
      "deepseek",
      "qwen",
      "moonshot",
      "ollama",
      "xiaomi-mimo",
      "openai-compatible",
    ]);
    expect(providers.every((provider) => "baseUrl" in provider && "apiKey" in provider)).toBe(true);
  });

  it("discovers OpenAI-compatible models from /v1/models and tags capabilities", async () => {
    const provider: ProviderConfig = {
      id: "custom",
      name: "Custom",
      type: "openai-compatible",
      baseUrl: "https://example.test/v1",
      apiKey: "test",
      enabled: true,
      supportsModelList: true,
    };
    const models = await discoverModels(provider, async (url) => {
      expect(String(url)).toBe("https://example.test/v1/models");
      return new Response(
        JSON.stringify({ data: [{ id: "gpt-code-large" }, { id: "text-embedding-3-small" }] })
      );
    });
    expect(models).toHaveLength(2);
    expect(models[0].capabilities).toEqual(expect.objectContaining({ chat: true, toolCalling: true }));
    expect(models[1].capabilities.embedding).toBe(true);
  });

  it("discovers Ollama models from /api/tags", async () => {
    const provider = createDefaultProviders().find((item) => item.type === "ollama")!;
    const models = await discoverModels(provider, async (url) => {
      expect(String(url)).toBe("http://localhost:11434/api/tags");
      return new Response(JSON.stringify({ models: [{ name: "llama3.2:latest" }] }));
    });
    expect(models[0]).toEqual(expect.objectContaining({ id: "llama3.2:latest", providerId: provider.id }));
    expect(models[0].capabilities.local).toBe(true);
  });

  it("uses fallback models when discovery is not supported", () => {
    const provider = createDefaultProviders().find((item) => item.type === "anthropic")!;
    const fallback = getFallbackModels(provider);
    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback[0].providerId).toBe(provider.id);
  });

  it("preserves stale models when refresh fails", () => {
    const provider = createDefaultProviders().find((item) => item.type === "anthropic")!;
    const fallback = getFallbackModels(provider);
    const existing = [{ ...fallback[0], stale: false }];
    const merged = mergeDiscoveredModels(existing, [], "network failed");
    expect(merged[0].stale).toBe(true);
    expect(merged[0].lastError).toBe("network failed");
  });
});
