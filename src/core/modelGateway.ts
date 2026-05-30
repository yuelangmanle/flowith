import type {
  ModelCapabilities,
  ModelConfig,
  ProviderConfig,
  ProviderType,
  TTSProviderConfig,
  TTSProviderType,
  StreamChunk,
  TokenBudget,
} from "./types";
import { estimateTokens } from "./tokenCounter";

// ─── Provider Defaults ──────────────────────────────────────────

const providerDefaults: Array<[ProviderType, string, string, boolean]> = [
  ["openai", "OpenAI", "https://api.openai.com/v1", true],
  ["anthropic", "Anthropic", "https://api.anthropic.com", true],
  ["gemini", "Gemini", "https://generativelanguage.googleapis.com/v1beta", true],
  ["deepseek", "DeepSeek", "https://api.deepseek.com/v1", true],
  ["qwen", "Qwen / DashScope", "https://dashscope.aliyuncs.com/compatible-mode/v1", true],
  ["moonshot", "Moonshot / Kimi", "https://api.moonshot.cn/v1", true],
  ["ollama", "Ollama", "http://localhost:11434", true],
  ["xiaomi-mimo", "Xiaomi MiMo", "https://api.xiaomimimo.com/v1", true],
  ["openai-compatible", "OpenAI-Compatible", "http://localhost:1234/v1", true],
];

export function createDefaultProviders(): ProviderConfig[] {
  return providerDefaults.map(([type, name, baseUrl, supportsModelList]) => ({
    id: type === "openai-compatible" ? "custom-openai-compatible" : type,
    type,
    name,
    baseUrl,
    apiKey: "",
    enabled: type === "ollama",
    supportsModelList,
  }));
}

// ─── TTS Provider Defaults ──────────────────────────────────────

const ttsProviderDefaults: Array<[TTSProviderType, string, string]> = [
  ["mimo-tts", "小米 MiMo TTS", "https://api.xiaomimimo.com/v1"],
  ["openai-tts", "OpenAI TTS", "https://api.openai.com/v1"],
  ["edge-tts", "Edge TTS (免费)", "https://speech.platform.bing.net"],
  ["fish-audio", "Fish Audio", "https://api.fish.audio"],
  ["custom-tts", "自定义 TTS", "http://localhost:9000"],
];

export function createDefaultTTSProviders(): TTSProviderConfig[] {
  return ttsProviderDefaults.map(([type, name, baseUrl]) => ({
    id: type,
    type,
    name,
    baseUrl,
    apiKey: "",
    enabled: type === "mimo-tts",
    defaultFormat: "wav",
    defaultSpeed: 1.0,
    ...(type === "mimo-tts" ? { defaultModel: "mimo-v2.5-tts", defaultVoice: "mimo_default" } : {}),
    ...(type === "openai-tts" ? { defaultModel: "tts-1", defaultVoice: "alloy" } : {}),
    ...(type === "fish-audio" ? { defaultModel: "fish-speech-1.5" } : {}),
  }));
}

// ─── Model Discovery ────────────────────────────────────────────

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
    const body = (await response.json()) as { models?: Array<{ name: string }> };
    return (body.models ?? []).map((model) => toModel(provider, model.name));
  }

  // Anthropic doesn't have a public /models endpoint
  if (provider.type === "anthropic") {
    return getFallbackModels(provider);
  }

  // Gemini uses a different URL format with API key
  if (provider.type === "gemini") {
    const geminiUrl = `${provider.baseUrl.replace(/\/$/, "")}/models?key=${provider.apiKey}`;
    const response = await fetcher(geminiUrl);
    if (!response.ok) throw new Error(`Model discovery failed: ${response.status}`);
    const body = (await response.json()) as {
      models?: Array<{ name: string; displayName?: string }>;
    };
    return (body.models ?? []).map((m) => toModel(provider, m.name.replace("models/", "")));
  }

  // OpenAI-compatible: openai, deepseek, qwen, moonshot, xiaomi-mimo, custom
  const discoverBase = provider.altBaseUrl || provider.baseUrl;
  const url = `${discoverBase.replace(/\/$/, "")}/models`;
  const headers: Record<string, string> = {};
  if (provider.apiKey) {
    headers["Authorization"] = `Bearer ${provider.apiKey}`;
    // MiMo also accepts api-key header
    if (provider.type === "xiaomi-mimo") headers["api-key"] = provider.apiKey;
  }

  const response = await fetcher(url, { headers });
  if (!response.ok) throw new Error(`Model discovery failed: ${response.status}`);
  const body = (await response.json()) as {
    data?: Array<{ id: string }>;
    models?: Array<{ name: string }>;
  };
  let ids =
    body.data?.map((model) => model.id) ?? body.models?.map((model) => model.name) ?? [];
  
  // Filter out known deprecated/obsolete models
  const DEPRECATED_IDS = new Set([
    "deepseek-coder",
    "deepseek-coder-v2",
    "deepseek-v2.5",
    "deepseek-v2",
    "deepseek-v1.5",
    "deepseek-lite",
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-0613",
    "gpt-3.5-turbo-16k",
    "gpt-3.5-turbo-instruct",
    "gpt-4-0314",
    "gpt-4-0613",
    "gpt-4-32k",
    "gpt-4-32k-0613",
    "text-davinci-003",
    "text-davinci-002",
    "text-embedding-ada-002",
    "davinci-002",
    "babbage-002",
  ]);
  // Also filter by prefix patterns for broader coverage
  const DEPRECATED_PREFIXES = ["dall-e-", "whisper-", "tts-", "ft:gpt-3.5"];
  ids = ids.filter((id) => !DEPRECATED_IDS.has(id) && !DEPRECATED_PREFIXES.some((p) => id.startsWith(p)));
  
  return ids.map((id) => toModel(provider, id));
}

export function getFallbackModels(provider: ProviderConfig): ModelConfig[] {
  const candidates: Record<ProviderType, string[]> = {
    openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o3-mini", "o3", "o4-mini", "text-embedding-3-small"],
    anthropic: ["claude-sonnet-4-20250514", "claude-haiku-4-20250514", "claude-opus-4-20250514"],
    gemini: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
    qwen: ["qwen-plus", "qwen-max", "qwen-turbo", "qwen3-235b-a22b", "qwen-vl-max", "text-embedding-v4"],
    moonshot: ["kimi-k2", "moonshot-v1-128k", "moonshot-v1-32k"],
    ollama: ["llama3.2:latest", "qwen2.5-coder:latest"],
    "xiaomi-mimo": ["mimo-v2.5-pro", "mimo-v2.5", "mimo-v2-flash", "mimo-v2-omni"],
    "openai-compatible": ["local-model", "openai-compatible-chat"],
  };
  return (candidates[provider.type] ?? []).map((id) => toModel(provider, id));
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

// ─── Chat Completion ────────────────────────────────────────────

export interface ChatCompletionRequest {
  provider: ProviderConfig;
  model: string;
  messages: Array<{ role: string; content: string; reasoningContent?: string; imageData?: string; additionalImages?: string[]; attachedFiles?: Array<{ name: string; type: string; size: number; content?: string }> }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  enableWebSearch?: boolean;
  webSearchMaxKeyword?: number;
  tokenBudget?: TokenBudget;
}

function buildChatMessages(msgs: ChatCompletionRequest["messages"]): Array<{ role: string; content: string | Array<Record<string, unknown>>; reasoning_content?: string }> {
  return msgs.map((m) => {
    // Append file content to message text
    let textContent = m.content;
    if (m.attachedFiles && m.attachedFiles.length > 0) {
      const fileParts = m.attachedFiles.filter(f => f.content).map(f => `\n\n[文件: ${f.name}]\n\`\`\`\n${f.content}\n\`\`\``);
      if (fileParts.length > 0) textContent += fileParts.join("");
    }
    // Build multimodal content if images present
    if (m.imageData) {
      const parts: Array<Record<string, unknown>> = [{ type: "text", text: textContent }];
      parts.push({ type: "image_url", image_url: { url: m.imageData } });
      if (m.additionalImages) {
        for (const img of m.additionalImages) {
          parts.push({ type: "image_url", image_url: { url: img } });
        }
      }
      const result: { role: string; content: string | Array<Record<string, unknown>>; reasoning_content?: string } = { role: m.role, content: parts };
      if (m.reasoningContent) result.reasoning_content = m.reasoningContent;
      return result;
    }
    const result: { role: string; content: string | Array<Record<string, unknown>>; reasoning_content?: string } = { role: m.role, content: textContent };
    if (m.reasoningContent) result.reasoning_content = m.reasoningContent;
    return result;
  });
}

// ─── Provider-Specific Chat (Non-streaming) ─────────────────────

export async function callChatCompletion(
  req: ChatCompletionRequest,
  fetcher: typeof fetch = fetch
): Promise<{ content: string; reasoningContent?: string; usage?: { prompt: number; completion: number; cachedTokens?: number; cacheCreationTokens?: number } }> {
  const provider = req.provider;
  const model = req.model;

  // Anthropic has its own API format
  if (provider.type === "anthropic") {
    return callAnthropic(req, fetcher);
  }

  // Gemini has its own API format
  if (provider.type === "gemini") {
    return callGemini(req, fetcher);
  }

  // OpenAI-compatible: openai, deepseek, qwen, moonshot, ollama, xiaomi-mimo, custom
  const url = buildUrl(provider, `/chat/completions`);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.apiKey) {
    headers["Authorization"] = `Bearer ${provider.apiKey}`;
    if (provider.type === "xiaomi-mimo") headers["api-key"] = provider.apiKey;
  }

  const bodyObj: Record<string, unknown> = {
    model,
    messages: buildChatMessages(req.messages),
    stream: false,
  };

  // ── Provider-specific parameters ──
  applyProviderParams(provider, model, bodyObj, req);

  const body = JSON.stringify(bodyObj);
  const response = await fetcher(url, { method: "POST", headers, body });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string; tool_calls?: unknown[] } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens?: number };
  };

  const choice = data.choices?.[0]?.message;
  const content = choice?.content ?? "";
  const reasoningContent = (choice as Record<string, unknown>)?.reasoning_content as string | undefined;
  const usage = data.usage
    ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens, cachedTokens: (data.usage as Record<string, unknown>).cached_tokens as number ?? 0 }
    : undefined;

  return { content, reasoningContent, usage };
}

// ─── Provider-Specific Streaming ────────────────────────────────

export async function* streamChatCompletion(
  req: ChatCompletionRequest,
  fetcher: typeof fetch = fetch
): AsyncGenerator<StreamChunk> {
  const provider = req.provider;

  if (provider.type === "anthropic") {
    yield* streamAnthropic(req, fetcher);
    return;
  }

  if (provider.type === "gemini") {
    yield* streamGemini(req, fetcher);
    return;
  }

  // OpenAI-compatible streaming
  const url = buildUrl(provider, `/chat/completions`);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.apiKey) {
    headers["Authorization"] = `Bearer ${provider.apiKey}`;
    if (provider.type === "xiaomi-mimo") headers["api-key"] = provider.apiKey;
  }

  const bodyObj: Record<string, unknown> = {
    model: req.model,
    messages: buildChatMessages(req.messages),
    stream: true,
  };

  // stream_options only for providers that support it (OpenAI, DeepSeek)
  if (provider.type === "openai" || provider.type === "deepseek") {
    bodyObj.stream_options = { include_usage: true };
  }

  // Provider-specific parameters
  applyProviderParams(provider, req.model, bodyObj, req);

  const body = JSON.stringify(bodyObj);
  const response = await fetcher(url, { method: "POST", headers, body });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    yield { type: "error", error: `API error ${response.status}: ${errText.slice(0, 300)}` };
    return;
  }

  // Parse SSE stream
  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: "error", error: "No response body" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let reasoningBuffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const chunk = JSON.parse(trimmed.slice(6)) as {
            choices?: Array<{ delta?: { content?: string; reasoning_content?: string; tool_calls?: unknown[] }; finish_reason?: string }>;
            usage?: { prompt_tokens: number; completion_tokens: number };
          };

          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            // Flush reasoning buffer before content
            if (reasoningBuffer) {
              yield { type: "text", content: `<think>${reasoningBuffer}</think>` };
              reasoningBuffer = "";
            }
            yield { type: "text", content: delta.content };
          }
          // Handle reasoning content from multiple providers
          // DeepSeek uses 'reasoning_content', some others use 'reasoning'
          const rContent = (delta as Record<string, unknown>)?.reasoning_content as string | undefined
            ?? (delta as Record<string, unknown>)?.reasoning as string | undefined;
          if (rContent) {
            reasoningBuffer += rContent;
          }
          if (chunk.usage) {
            yield {
              type: "usage",
              usage: {
                prompt: chunk.usage.prompt_tokens,
                completion: chunk.usage.completion_tokens,
                cachedTokens: (chunk.usage as Record<string, unknown>).cached_tokens as number ?? 0,
              },
            };
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Flush any remaining reasoning buffer
  if (reasoningBuffer) {
    yield { type: "text", content: `<think>${reasoningBuffer}</think>` };
  }
  yield { type: "done" };
}

// ─── Provider-Specific Parameter Building ───────────────────────

/** Infer optimal max_tokens based on message content length */
function inferMaxTokens(messages: Array<{ role: string; content: string }>): number {
  let totalInput = 0;
  for (const msg of messages) {
    totalInput += estimateTokens(msg.content);
  }
  if (totalInput < 100) return 1024;
  if (totalInput < 500) return 2048;
  return 4096;
}

function applyProviderParams(
  provider: ProviderConfig,
  model: string,
  body: Record<string, unknown>,
  req: ChatCompletionRequest
): void {
  const lower = model.toLowerCase();

  switch (provider.type) {
    case "openai": {
      // o-series reasoning models: use reasoning_effort, no temperature
      if (lower.startsWith("o3") || lower.startsWith("o4") || lower.startsWith("o1")) {
        body.reasoning_effort = provider.reasoningEffort ?? "medium";
        // o-series don't support temperature
        delete body.temperature;
      } else {
        body.temperature = req.temperature ?? 0.7;
        body.max_tokens = req.maxTokens ?? inferMaxTokens(req.messages);
      }
      break;
    }

    case "deepseek": {
      // deepseek-reasoner: temperature must be 0 or omitted
      if (lower.includes("reasoner")) {
        body.temperature = 0;
        // Don't set max_tokens for reasoner — it uses max_reasoning_tokens
      } else {
        body.temperature = req.temperature ?? 0.7;
        body.max_tokens = req.maxTokens ?? inferMaxTokens(req.messages);
      }
      // DeepSeek supports tool_choice
      break;
    }

    case "qwen": {
      body.temperature = req.temperature ?? 0.7;
      body.max_tokens = req.maxTokens ?? inferMaxTokens(req.messages);
      // qwen3 thinking mode
      if (lower.startsWith("qwen3") && provider.enableThinking) {
        body.enable_thinking = true;
      }
      // Qwen web search
      if (req.enableWebSearch ?? provider.enableSearch) {
        body.enable_search = true;
      }
      break;
    }

    case "moonshot": {
      body.temperature = req.temperature ?? 0.7;
      body.max_tokens = req.maxTokens ?? inferMaxTokens(req.messages);
      // kimi-k2 is a reasoning model — lower temperature helps
      if (lower.includes("k2")) {
        body.temperature = req.temperature ?? 0.3;
      }
      // Moonshot web search via tool
      if (req.enableWebSearch ?? provider.moonshotWebSearch) {
        body.tools = [{
          type: "builtin_function",
          function: { name: "$web_search" },
        }];
      }
      break;
    }

    case "xiaomi-mimo": {
      body.temperature = req.temperature ?? 0.7;
      body.max_tokens = req.maxTokens ?? inferMaxTokens(req.messages);
      // MiMo web search — align webSearchEnabled with tools presence
      const mimoWebSearch = req.enableWebSearch === true || (req.enableWebSearch !== false && provider.webSearchEnabled === true);
      if (mimoWebSearch) {
        body.webSearchEnabled = true;
        body.tools = [{
          type: "web_search",
          max_keyword: req.webSearchMaxKeyword ?? provider.webSearchMaxKeyword ?? 3,
        }];
      } else {
        // Explicitly disable to prevent MiMo API "tool found but webSearchEnabled is false" error
        body.webSearchEnabled = false;
      }
      break;
    }

    case "ollama": {
      body.temperature = req.temperature ?? 0.7;
      // Ollama doesn't always support max_tokens
      break;
    }

    case "openai-compatible": {
      body.temperature = req.temperature ?? 0.7;
      body.max_tokens = req.maxTokens ?? inferMaxTokens(req.messages);
      break;
    }

    default: {
      body.temperature = req.temperature ?? 0.7;
      body.max_tokens = req.maxTokens ?? inferMaxTokens(req.messages);
    }
  }
}

// ─── Anthropic (Messages API) ───────────────────────────────────

async function callAnthropic(
  req: ChatCompletionRequest,
  fetcher: typeof fetch
): Promise<{ content: string; reasoningContent?: string; usage?: { prompt: number; completion: number; cachedTokens?: number; cacheCreationTokens?: number } }> {
  const url = `${req.provider.baseUrl.replace(/\/$/, "")}/messages`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": req.provider.apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "prompt-caching-2024-07-31",
  };

  // Extract system message
  const systemMsg = req.messages.find((m) => m.role === "system");
  const nonSystemMsgs = req.messages.filter((m) => m.role !== "system");

  const dynamicMaxTokens = req.maxTokens ?? inferMaxTokens(req.messages);

  const bodyObj: Record<string, unknown> = {
    model: req.model,
    max_tokens: dynamicMaxTokens,
    messages: nonSystemMsgs.map((m) => ({ role: m.role, content: m.content })),
  };
  // Use array format with cache_control for system message (Anthropic prompt caching)
  if (systemMsg) {
    bodyObj.system = [{ type: "text", text: systemMsg.content, cache_control: { type: "ephemeral" } }];
  }

  // Claude Sonnet/Opus 4: enable extended thinking
  if (req.model.includes("sonnet-4") || req.model.includes("opus-4")) {
    bodyObj.thinking = { type: "enabled", budget_tokens: Math.min(dynamicMaxTokens, 10000) };
    // Extended thinking requires temperature=1
    bodyObj.temperature = 1;
  } else {
    bodyObj.temperature = req.temperature ?? 0.7;
  }

  const body = JSON.stringify(bodyObj);
  const response = await fetcher(url, { method: "POST", headers, body });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Anthropic error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string; thinking?: string }>;
    usage?: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number };
  };

  // Extract text and thinking blocks
  let content = "";
  let reasoningContent = "";
  for (const block of data.content ?? []) {
    if (block.type === "thinking") {
      reasoningContent += (block as Record<string, unknown>).thinking as string ?? "";
    } else {
      // Default to text if type is missing or "text"
      content += block.text ?? "";
    }
  }

  const cachedTokens = (data.usage?.cache_read_input_tokens ?? 0);
  const cacheCreationTokens = (data.usage?.cache_creation_input_tokens ?? 0);
  const usage = data.usage
    ? { prompt: data.usage.input_tokens, completion: data.usage.output_tokens, cachedTokens, cacheCreationTokens }
    : undefined;

  return { content, reasoningContent: reasoningContent || undefined, usage };
}

async function* streamAnthropic(
  req: ChatCompletionRequest,
  fetcher: typeof fetch
): AsyncGenerator<StreamChunk> {
  const url = `${req.provider.baseUrl.replace(/\/$/, "")}/messages`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": req.provider.apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "prompt-caching-2024-07-31",
  };

  const systemMsg = req.messages.find((m) => m.role === "system");
  const nonSystemMsgs = req.messages.filter((m) => m.role !== "system");

  const dynamicMaxTokens = req.maxTokens ?? inferMaxTokens(req.messages);

  const bodyObj: Record<string, unknown> = {
    model: req.model,
    max_tokens: dynamicMaxTokens,
    messages: nonSystemMsgs.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
  };
  // Use array format with cache_control for system message (Anthropic prompt caching)
  if (systemMsg) {
    bodyObj.system = [{ type: "text", text: systemMsg.content, cache_control: { type: "ephemeral" } }];
  }
  // Cache the last user message for better cache hits on repeated queries
  const msgs = bodyObj.messages as Array<Record<string, unknown>>;
  if (msgs.length > 1) {
    const lastMsg = msgs[msgs.length - 1];
    if (lastMsg.role === "user") {
      lastMsg.cache_control = { type: "ephemeral" };
    }
  }

  if (req.model.includes("sonnet-4") || req.model.includes("opus-4")) {
    bodyObj.thinking = { type: "enabled", budget_tokens: Math.min(dynamicMaxTokens, 10000) };
    bodyObj.temperature = 1;
  } else {
    bodyObj.temperature = req.temperature ?? 0.7;
  }

  const body = JSON.stringify(bodyObj);
  const response = await fetcher(url, { method: "POST", headers, body });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    yield { type: "error", error: `Anthropic error ${response.status}: ${errText.slice(0, 300)}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) { yield { type: "error", error: "No response body" }; return; }

  const decoder = new TextDecoder();
  let buffer = "";
  let thinkingBuffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(trimmed.slice(6)) as Record<string, unknown>;
          if (event.type === "content_block_delta") {
            const delta = event.delta as Record<string, unknown> | undefined;
            if (delta?.type === "text_delta" && delta.text) {
              // Flush thinking buffer before text content
              if (thinkingBuffer) {
                yield { type: "text", content: `<think>${thinkingBuffer}</think>` };
                thinkingBuffer = "";
              }
              yield { type: "text", content: delta.text as string };
            }
            if (delta?.type === "thinking_delta" && delta.thinking) {
              thinkingBuffer += delta.thinking as string;
            }
          }
          if (event.type === "message_delta") {
            const usage = event.usage as { input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } | undefined;
            if (usage) {
              yield {
                type: "usage",
                usage: {
                  prompt: usage.input_tokens ?? 0,
                  completion: usage.output_tokens ?? 0,
                  cachedTokens: usage.cache_read_input_tokens ?? 0,
                  cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
                },
              };
            }
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
  // Flush remaining thinking buffer
  if (thinkingBuffer) {
    yield { type: "text", content: `<think>${thinkingBuffer}</think>` };
  }
  yield { type: "done" };
}

// ─── Gemini (GenerateContent API) ───────────────────────────────

async function callGemini(
  req: ChatCompletionRequest,
  fetcher: typeof fetch
): Promise<{ content: string; reasoningContent?: string; usage?: { prompt: number; completion: number; cachedTokens?: number; cacheCreationTokens?: number } }> {
  const base = req.provider.baseUrl.replace(/\/$/, "");
  const url = `${base}/models/${req.model}:generateContent?key=${req.provider.apiKey}`;

  const systemMsg = req.messages.find((m) => m.role === "system");
  const nonSystemMsgs = req.messages.filter((m) => m.role !== "system");

  const contents = nonSystemMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const bodyObj: Record<string, unknown> = { contents };
  if (systemMsg) {
    bodyObj.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  // Gemini 2.5 thinking config
  const lower = req.model.toLowerCase();
  if (lower.includes("2.5")) {
    bodyObj.generationConfig = {
      temperature: req.temperature ?? 0.7,
      maxOutputTokens: req.maxTokens ?? 4096,
      thinkingConfig: { includeThoughts: true },
    };
  } else {
    bodyObj.generationConfig = {
      temperature: req.temperature ?? 0.7,
      maxOutputTokens: req.maxTokens ?? 4096,
    };
  }

  const body = JSON.stringify(bodyObj);
  const response = await fetcher(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Gemini error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
    usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
  };

  let content = "";
  let reasoningContent = "";
  for (const part of data.candidates?.[0]?.content?.parts ?? []) {
    if (part.thought) reasoningContent += part.text ?? "";
    else content += part.text ?? "";
  }

  const usage = data.usageMetadata
    ? { prompt: data.usageMetadata.promptTokenCount, completion: data.usageMetadata.candidatesTokenCount }
    : undefined;

  return { content, reasoningContent: reasoningContent || undefined, usage };
}

async function* streamGemini(
  req: ChatCompletionRequest,
  fetcher: typeof fetch
): AsyncGenerator<StreamChunk> {
  const base = req.provider.baseUrl.replace(/\/$/, "");
  const url = `${base}/models/${req.model}:streamGenerateContent?alt=sse&key=${req.provider.apiKey}`;

  const systemMsg = req.messages.find((m) => m.role === "system");
  const nonSystemMsgs = req.messages.filter((m) => m.role !== "system");

  const contents = nonSystemMsgs.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const bodyObj: Record<string, unknown> = { contents };
  if (systemMsg) bodyObj.systemInstruction = { parts: [{ text: systemMsg.content }] };

  const lower = req.model.toLowerCase();
  if (lower.includes("2.5")) {
    bodyObj.generationConfig = {
      temperature: req.temperature ?? 0.7,
      maxOutputTokens: req.maxTokens ?? 4096,
      thinkingConfig: { includeThoughts: true },
    };
  } else {
    bodyObj.generationConfig = {
      temperature: req.temperature ?? 0.7,
      maxOutputTokens: req.maxTokens ?? 4096,
    };
  }

  const body = JSON.stringify(bodyObj);
  const response = await fetcher(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    yield { type: "error", error: `Gemini error ${response.status}: ${errText.slice(0, 300)}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) { yield { type: "error", error: "No response body" }; return; }

  const decoder = new TextDecoder();
  let buffer = "";
  let geminiThinkingBuffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        try {
          const chunk = JSON.parse(trimmed.slice(6)) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
            usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
          };
          for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
            if (part.text) {
              if (part.thought) {
                geminiThinkingBuffer += part.text ?? "";
              } else {
                // Flush thinking buffer before content
                if (geminiThinkingBuffer) {
                  yield { type: "text", content: `<think>${geminiThinkingBuffer}</think>` };
                  geminiThinkingBuffer = "";
                }
                yield { type: "text", content: part.text };
              }
            }
          }
          if (chunk.usageMetadata) {
            yield { type: "usage", usage: { prompt: chunk.usageMetadata.promptTokenCount, completion: chunk.usageMetadata.candidatesTokenCount } };
          }
        } catch { /* skip */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
  // Flush remaining thinking buffer
  if (geminiThinkingBuffer) {
    yield { type: "text", content: `<think>${geminiThinkingBuffer}</think>` };
  }
  yield { type: "done" };
}

// ─── Helpers ────────────────────────────────────────────────────

function buildUrl(provider: ProviderConfig, path: string): string {
  const base = provider.altBaseUrl || provider.baseUrl;
  return `${base.replace(/\/$/, "")}${path}`;
}

function toModel(provider: ProviderConfig, id: string): ModelConfig {
  return {
    id,
    providerId: provider.id,
    name: id,
    capabilities: inferCapabilities(provider, id),
  };
}

export function inferCapabilities(provider: ProviderConfig, id: string): ModelCapabilities {
  const lower = id.toLowerCase();
  const embedding = lower.includes("embedding") || lower.includes("embed");
  const local = provider.type === "ollama";
  const isMimo = provider.type === "xiaomi-mimo";
  const isMimoTts = lower.includes("tts");

  return {
    chat: !embedding && !isMimoTts,
    completion: !embedding && !isMimoTts,
    embedding,
    // Vision: GPT-4o/4v, Gemini, Qwen-VL, MiMo Omni
    vision:
      lower.includes("vision") || lower.includes("gpt-4o") || lower.includes("gpt-4.1") ||
      lower.includes("gemini") || lower.includes("vl") ||
      (isMimo && (lower.includes("omni") || lower === "mimo-v2.5")),
    // Tool calling: most cloud providers support it
    toolCalling: !embedding && !local && !isMimoTts,
    jsonMode: !embedding && !isMimoTts,
    // Reasoning models
    reasoning:
      lower.includes("reason") ||           // DeepSeek Reasoner
      lower.includes("o3") || lower.includes("o4") || lower.includes("o1") ||  // OpenAI o-series
      lower.includes("sonnet-4") || lower.includes("opus-4") ||  // Claude extended thinking
      lower.includes("2.5-pro") ||          // Gemini 2.5 Pro thinking
      lower.includes("k2") ||               // Kimi K2
      lower.includes("qwen3") ||            // Qwen3 thinking
      (isMimo && lower.includes("pro")),
    local,
    fast:
      lower.includes("mini") || lower.includes("flash") || lower.includes("haiku") ||
      lower.includes("turbo") || lower.includes("4.1-mini") ||
      (isMimo && lower.includes("flash")),
    cheap:
      lower.includes("mini") || lower.includes("flash") || lower.includes("haiku") ||
      lower.includes("turbo") || local,
    largeContext:
      lower.includes("32k") || lower.includes("64k") || lower.includes("128k") ||
      lower.includes("gemini") || lower.includes("sonnet") || lower.includes("k2") ||
      lower.includes("gpt-4.1") ||
      (isMimo && (lower.includes("pro") || lower.includes("omni") || lower === "mimo-v2.5")),
  };
}

export function getBestModelForTask(
  providers: ProviderConfig[],
  allModels: ModelConfig[],
  task: "chat" | "reasoning" | "fast" | "code"
): { provider: ProviderConfig; model: ModelConfig } | null {
  const enabled = providers.filter((p) => p.enabled && p.apiKey);
  if (enabled.length === 0 && !providers.some((p) => p.type === "ollama" && p.enabled)) return null;

  const available = allModels.filter((m) =>
    providers.some((p) => p.id === m.providerId && p.enabled)
  );

  let filtered: ModelConfig[];
  switch (task) {
    case "reasoning":
      filtered = available.filter((m) => m.capabilities.reasoning);
      break;
    case "fast":
      filtered = available.filter((m) => m.capabilities.fast);
      break;
    case "code":
      filtered = available.filter((m) => m.capabilities.chat && !m.capabilities.embedding);
      break;
    default:
      filtered = available.filter((m) => m.capabilities.chat);
  }

  if (filtered.length === 0) filtered = available.filter((m) => !m.capabilities.embedding);
  if (filtered.length === 0) return null;

  const model = filtered[0];
  const provider = providers.find((p) => p.id === model.providerId);
  if (!provider) return null;
  return { provider, model };
}


// ═══════════════════════════════════════════════════════════════
// ─── Independent TTS Provider System ────────────────────────────
// ═══════════════════════════════════════════════════════════════

export interface TTSRequest {
  text: string;
  ttsProvider: TTSProviderConfig;
  voice?: string;
  model?: string;
  format?: "wav" | "mp3" | "pcm16";
  speed?: number;
  stylePrompt?: string;
  instructions?: string;  // OpenAI TTS
}

export async function callTTS(
  req: TTSRequest,
  fetcher: typeof fetch = fetch
): Promise<{ audioBase64: string; format: string }> {
  switch (req.ttsProvider.type) {
    case "mimo-tts":
      return callMiMoTTS(req, fetcher);
    case "openai-tts":
      return callOpenAITTS(req, fetcher);
    case "fish-audio":
      return callFishAudioTTS(req, fetcher);
    case "edge-tts":
      return callEdgeTTS(req, fetcher);
    case "custom-tts":
      return callCustomTTS(req, fetcher);
    default:
      throw new Error(`Unsupported TTS provider: ${req.ttsProvider.type}`);
  }
}

// ─── MiMo TTS ──────────────────────────────────────────────────

async function callMiMoTTS(
  req: TTSRequest,
  fetcher: typeof fetch
): Promise<{ audioBase64: string; format: string }> {
  const p = req.ttsProvider;
  const baseUrl = p.mimoAltBaseUrl || p.baseUrl;
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const messages: Array<{ role: string; content: string }> = [];
  if (req.stylePrompt ?? p.defaultStylePrompt) {
    messages.push({ role: "user", content: req.stylePrompt ?? p.defaultStylePrompt ?? "" });
  }
  messages.push({ role: "assistant", content: req.text });

  const audioConfig: Record<string, unknown> = {
    format: req.format ?? p.defaultFormat ?? "wav",
    voice: req.voice ?? p.defaultVoice ?? "mimo_default",
  };
  const spd = req.speed ?? p.defaultSpeed;
  if (spd !== undefined && spd !== 1.0) audioConfig.speed = spd;

  const body = JSON.stringify({
    model: req.model ?? p.defaultModel ?? "mimo-v2.5-tts",
    messages,
    audio: audioConfig,
  });

  const response = await fetcher(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": p.apiKey,
      "Authorization": `Bearer ${p.apiKey}`,
    },
    body,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`MiMo TTS error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { audio?: { data?: string } } }>;
  };

  const audioData = data.choices?.[0]?.message?.audio?.data;
  if (!audioData) throw new Error("No audio data in TTS response");

  return { audioBase64: audioData, format: req.format ?? p.defaultFormat ?? "wav" };
}

// ─── OpenAI TTS ────────────────────────────────────────────────

async function callOpenAITTS(
  req: TTSRequest,
  fetcher: typeof fetch
): Promise<{ audioBase64: string; format: string }> {
  const p = req.ttsProvider;
  const url = `${p.baseUrl.replace(/\/$/, "")}/audio/speech`;

  const bodyObj: Record<string, unknown> = {
    model: req.model ?? p.defaultModel ?? "tts-1",
    input: req.text,
    voice: req.voice ?? p.defaultVoice ?? "alloy",
    response_format: req.format === "pcm16" ? "pcm" : (req.format ?? p.defaultFormat ?? "mp3"),
  };
  if (req.speed ?? p.defaultSpeed) bodyObj.speed = req.speed ?? p.defaultSpeed;
  if (req.instructions ?? p.openaiInstructions) bodyObj.instructions = req.instructions ?? p.openaiInstructions;

  const response = await fetcher(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify(bodyObj),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`OpenAI TTS error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const arrayBuf = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const audioBase64 = btoa(binary);

  return { audioBase64, format: req.format ?? p.defaultFormat ?? "mp3" };
}

// ─── Fish Audio TTS ────────────────────────────────────────────

async function callFishAudioTTS(
  req: TTSRequest,
  fetcher: typeof fetch
): Promise<{ audioBase64: string; format: string }> {
  const p = req.ttsProvider;
  const url = `${p.baseUrl.replace(/\/$/, "")}/v1/tts`;

  const bodyObj: Record<string, unknown> = {
    text: req.text,
    reference_id: req.voice ?? p.fishReferenceId ?? p.defaultVoice,
    format: req.format === "pcm16" ? "wav" : (req.format ?? p.defaultFormat ?? "wav"),
  };
  if (req.speed ?? p.defaultSpeed) bodyObj.speed = req.speed ?? p.defaultSpeed;

  const response = await fetcher(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify(bodyObj),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Fish Audio TTS error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const arrayBuf = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const audioBase64 = btoa(binary);

  return { audioBase64, format: req.format ?? p.defaultFormat ?? "wav" };
}

// ─── Edge TTS (free, via WebSocket relay or REST proxy) ─────────

async function callEdgeTTS(
  req: TTSRequest,
  fetcher: typeof fetch
): Promise<{ audioBase64: string; format: string }> {
  // Edge TTS typically requires a relay server (e.g., edge-tts npm package)
  // This calls a self-hosted REST proxy
  const p = req.ttsProvider;
  const url = `${p.baseUrl.replace(/\/$/, "")}/tts`;

  const bodyObj: Record<string, unknown> = {
    text: req.text,
    voice: req.voice ?? p.defaultVoice ?? "zh-CN-XiaoxiaoNeural",
    rate: req.speed ? `${((req.speed - 1) * 100).toFixed(0)}%` : "+0%",
    format: req.format ?? "mp3",
  };

  const response = await fetcher(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyObj),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Edge TTS error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const arrayBuf = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const audioBase64 = btoa(binary);

  return { audioBase64, format: req.format ?? "mp3" };
}

// ─── Custom TTS ────────────────────────────────────────────────

async function callCustomTTS(
  req: TTSRequest,
  fetcher: typeof fetch
): Promise<{ audioBase64: string; format: string }> {
  const p = req.ttsProvider;
  const url = p.baseUrl.replace(/\/$/, "");

  // Use request template if provided
  let body: string;
  if (p.requestTemplate) {
    body = p.requestTemplate
      .replace("{{text}}", req.text)
      .replace("{{voice}}", req.voice ?? p.defaultVoice ?? "")
      .replace("{{model}}", req.model ?? p.defaultModel ?? "")
      .replace("{{speed}}", String(req.speed ?? p.defaultSpeed ?? 1.0))
      .replace("{{format}}", req.format ?? p.defaultFormat ?? "wav");
  } else {
    body = JSON.stringify({
      text: req.text,
      voice: req.voice ?? p.defaultVoice,
      model: req.model ?? p.defaultModel,
      speed: req.speed ?? p.defaultSpeed,
      format: req.format ?? p.defaultFormat ?? "wav",
    });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (p.apiKey) headers["Authorization"] = `Bearer ${p.apiKey}`;
  if (p.customHeaders) Object.assign(headers, p.customHeaders);

  const response = await fetcher(url, { method: "POST", headers, body });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Custom TTS error ${response.status}: ${errText.slice(0, 300)}`);
  }

  // Try to parse as JSON first (base64 response), fallback to binary
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    const data = await response.json() as Record<string, unknown>;
    const audioBase64 = (data.audioBase64 ?? data.audio ?? data.data ?? "") as string;
    if (!audioBase64) throw new Error("No audio data in custom TTS response");
    return { audioBase64, format: (data.format as string) ?? req.format ?? "wav" };
  }

  const arrayBuf = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const audioBase64 = btoa(binary);

  return { audioBase64, format: req.format ?? "wav" };
}
