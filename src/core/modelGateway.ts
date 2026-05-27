import type { ModelCapabilities, ModelConfig, ProviderConfig, ProviderType } from "./types";

const providerDefaults: Array<[ProviderType, string, string, boolean]> = [
  ["openai", "OpenAI", "https://api.openai.com/v1", true],
  ["anthropic", "Anthropic", "https://api.anthropic.com/v1", false],
  ["gemini", "Gemini", "https://generativelanguage.googleapis.com/v1beta", true],
  ["deepseek", "DeepSeek", "https://api.deepseek.com/v1", true],
  ["qwen", "Qwen / DashScope", "https://dashscope.aliyuncs.com/compatible-mode/v1", true],
  ["moonshot", "Moonshot / Kimi", "https://api.moonshot.cn/v1", true],
  ["ollama", "Ollama", "http://localhost:11434", true],
  ["openai-compatible", "OpenAI-Compatible", "http://localhost:1234/v1", true]
];

export function createDefaultProviders(): ProviderConfig[] {
  return providerDefaults.map(([type, name, baseUrl, supportsModelList]) => ({
    id: type === "openai-compatible" ? "custom-openai-compatible" : type,
    type,
    name,
    baseUrl,
    apiKey: "",
    enabled: type === "ollama",
    supportsModelList
  }));
}

export async function discoverModels(
  provider: ProviderConfig,
  fetcher: typeof fetch = fetch
): Promise<ModelConfig[]> {
  if (!provider.supportsModelList) {
    return getFallbackModels(provider);
  }

  if (provider.type === "ollama") {
    const response = await fetcher(`${provider.baseUrl.replace(/\/$/, "")}/api/tags`);
    if (!response.ok) throw new Error(`Model discovery failed: ${response.status}`);
    const body = await response.json() as { models?: Array<{ name: string }> };
    return (body.models ?? []).map((model) => toModel(provider, model.name));
  }

  const url = `${provider.baseUrl.replace(/\/$/, "")}/models`;
  const response = await fetcher(url, {
    headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : undefined
  });
  if (!response.ok) throw new Error(`Model discovery failed: ${response.status}`);
  const body = await response.json() as { data?: Array<{ id: string }>; models?: Array<{ name: string }> };
  const ids = body.data?.map((model) => model.id) ?? body.models?.map((model) => model.name) ?? [];
  return ids.map((id) => toModel(provider, id));
}

export function getFallbackModels(provider: ProviderConfig): ModelConfig[] {
  const candidates: Record<ProviderType, string[]> = {
    openai: ["gpt-4.1", "gpt-4.1-mini", "text-embedding-3-small"],
    anthropic: ["claude-sonnet-4-5", "claude-haiku-4-5"],
    gemini: ["gemini-2.5-pro", "gemini-2.5-flash"],
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
    qwen: ["qwen-plus", "qwen-max", "text-embedding-v4"],
    moonshot: ["kimi-k2", "moonshot-v1-32k"],
    ollama: ["llama3.2:latest", "qwen2.5-coder:latest"],
    "openai-compatible": ["local-model", "openai-compatible-chat"]
  };
  return candidates[provider.type].map((id) => toModel(provider, id));
}

export function mergeDiscoveredModels(
  existing: ModelConfig[],
  discovered: ModelConfig[],
  error?: string
): ModelConfig[] {
  if (discovered.length > 0) {
    const seen = new Set<string>();
    return [...discovered, ...existing]
      .filter((model) => {
        const key = `${model.providerId}:${model.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((model) => ({ ...model, stale: false, lastError: undefined }));
  }
  return existing.map((model) => ({ ...model, stale: true, lastError: error }));
}

function toModel(provider: ProviderConfig, id: string): ModelConfig {
  return {
    id,
    providerId: provider.id,
    name: id,
    capabilities: inferCapabilities(provider, id)
  };
}

export function inferCapabilities(provider: ProviderConfig, id: string): ModelCapabilities {
  const lower = id.toLowerCase();
  const embedding = lower.includes("embedding") || lower.includes("embed");
  const local = provider.type === "ollama";
  return {
    chat: !embedding,
    completion: !embedding,
    embedding,
    vision: lower.includes("vision") || lower.includes("gemini") || lower.includes("gpt-4"),
    toolCalling: !embedding && !local,
    jsonMode: !embedding,
    reasoning: lower.includes("reason") || lower.includes("pro") || lower.includes("sonnet") || lower.includes("gpt"),
    local,
    fast: lower.includes("mini") || lower.includes("flash") || lower.includes("haiku"),
    cheap: lower.includes("mini") || lower.includes("flash") || lower.includes("haiku") || local,
    largeContext: lower.includes("32k") || lower.includes("128k") || lower.includes("gemini") || lower.includes("sonnet")
  };
}

