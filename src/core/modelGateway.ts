import type {
  ModelCapabilities,
  ModelConfig,
  ProviderConfig,
  ProviderType,
  ChatMessage,
  StreamChunk,
} from "./types";

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

  if (provider.type === "anthropic") {
    return getFallbackModels(provider);
  }

  const url = `${provider.baseUrl.replace(/\/$/, "")}/models`;
  const headers: Record<string, string> = {};
  if (provider.apiKey) {
    headers["Authorization"] = `Bearer ${provider.apiKey}`;
    if (provider.type === "xiaomi-mimo") headers["api-key"] = provider.apiKey;
  }
  if (provider.type === "gemini") {
    const geminiUrl = `${provider.baseUrl.replace(/\/$/, "")}/models?key=${provider.apiKey}`;
    const response = await fetcher(geminiUrl);
    if (!response.ok) throw new Error(`Model discovery failed: ${response.status}`);
    const body = (await response.json()) as {
      models?: Array<{ name: string; displayName?: string }>;
    };
    return (body.models ?? []).map((m) => toModel(provider, m.name.replace("models/", "")));
  }

  const response = await fetcher(url, { headers });
  if (!response.ok) throw new Error(`Model discovery failed: ${response.status}`);
  const body = (await response.json()) as {
    data?: Array<{ id: string }>;
    models?: Array<{ name: string }>;
  };
  const ids =
    body.data?.map((model) => model.id) ?? body.models?.map((model) => model.name) ?? [];
  return ids.map((id) => toModel(provider, id));
}

export function getFallbackModels(provider: ProviderConfig): ModelConfig[] {
  const candidates: Record<ProviderType, string[]> = {
    openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini", "o3-mini", "text-embedding-3-small"],
    anthropic: ["claude-sonnet-4-20250514", "claude-haiku-4-20250514"],
    gemini: ["gemini-2.5-pro", "gemini-2.5-flash"],
    deepseek: ["deepseek-chat", "deepseek-reasoner"],
    qwen: ["qwen-plus", "qwen-max", "qwen-turbo", "qwen3-235b-a22b", "qwen-vl-max", "text-embedding-v4"],
    moonshot: ["kimi-k2", "moonshot-v1-128k", "moonshot-v1-32k"],
    ollama: ["llama3.2:latest", "qwen2.5-coder:latest"],
    "xiaomi-mimo": ["mimo-v2.5-pro", "mimo-v2.5", "mimo-v2-flash", "mimo-v2.5-tts"],
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

// ─── Real Chat Completion ───────────────────────────────────────

export interface ChatCompletionRequest {
  provider: ProviderConfig;
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  // MiMo web search
  enableWebSearch?: boolean;
  webSearchMaxKeyword?: number;
}

export async function callChatCompletion(
  req: ChatCompletionRequest,
  fetcher: typeof fetch = fetch
): Promise<{ content: string; usage?: { prompt: number; completion: number } }> {
  const provider = req.provider;
  const model = req.model;

  if (provider.type === "anthropic") {
    return callAnthropic(req, fetcher);
  }

  if (provider.type === "gemini") {
    return callGemini(req, fetcher);
  }

  // OpenAI-compatible: openai, deepseek, qwen, moonshot, ollama, xiaomi-mimo, custom
  const url = buildUrl(provider, `/chat/completions`);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.apiKey) {
    headers["Authorization"] = `Bearer ${provider.apiKey}`;
    // MiMo supports both auth methods
    if (provider.type === "xiaomi-mimo") headers["api-key"] = provider.apiKey;
  }

  // Build request body with provider-specific optimizations
  const bodyObj: Record<string, unknown> = {
    model,
    messages: req.messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 4096,
    stream: false,
  };

  // DeepSeek: reasoning models work best with temperature=0 (or omit)
  if (provider.type === "deepseek" && model.includes("reasoner")) {
    bodyObj.temperature = 0;
  }

  // MiMo: inject web search tools when enabled
  if (provider.type === "xiaomi-mimo") {
    bodyObj.thinking = { type: "disabled" };
    if (req.enableWebSearch ?? provider.webSearchEnabled) {
      bodyObj.tools = [{
        type: "web_search",
        max_keyword: req.webSearchMaxKeyword ?? provider.webSearchMaxKeyword ?? 3,
        force_search: true,
      }];
    }
  }

  const body = JSON.stringify(bodyObj);

  const response = await fetcher(url, { method: "POST", headers, body });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };

  const content = data.choices?.[0]?.message?.content ?? "";
  const usage = data.usage
    ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens }
    : undefined;

  return { content, usage };
}

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

  // Build request body with provider-specific optimizations
  const streamBodyObj: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 4096,
    stream: true,
  };

  // DeepSeek: reasoning models work best with temperature=0
  if (provider.type === "deepseek" && req.model.includes("reasoner")) {
    streamBodyObj.temperature = 0;
  }

  // MiMo: inject web search tools when enabled
  if (provider.type === "xiaomi-mimo") {
    streamBodyObj.thinking = { type: "disabled" };
    if (req.enableWebSearch ?? provider.webSearchEnabled) {
      streamBodyObj.tools = [{
        type: "web_search",
        max_keyword: req.webSearchMaxKeyword ?? provider.webSearchMaxKeyword ?? 3,
        force_search: true,
      }];
    }
  }

  const body = JSON.stringify(streamBodyObj);

  const response = await fetcher(url, { method: "POST", headers, body });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    yield { type: "text", content: data.choices?.[0]?.message?.content ?? "" };
    yield { type: "done" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

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
        const payload = JSON.parse(trimmed.slice(6)) as {
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
          usage?: { prompt_tokens: number; completion_tokens: number };
        };

        const delta = payload.choices?.[0]?.delta?.content;
        if (delta) yield { type: "text", content: delta };

        if (payload.choices?.[0]?.finish_reason === "stop" && payload.usage) {
          yield {
            type: "usage",
            usage: { prompt: payload.usage.prompt_tokens, completion: payload.usage.completion_tokens },
          };
        }
      } catch {
        // skip malformed lines
      }
    }
  }

  yield { type: "done" };
}

// ─── Anthropic ──────────────────────────────────────────────────

async function callAnthropic(
  req: ChatCompletionRequest,
  fetcher: typeof fetch
): Promise<{ content: string; usage?: { prompt: number; completion: number } }> {
  const url = `${req.provider.baseUrl.replace(/\/$/, "")}/messages`;
  const systemMsg = req.messages.find((m) => m.role === "system");
  const nonSystem = req.messages.filter((m) => m.role !== "system");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": req.provider.apiKey,
    "anthropic-version": "2023-06-01",
  };

  const body = JSON.stringify({
    model: req.model,
    max_tokens: req.maxTokens ?? 4096,
    system: systemMsg?.content,
    messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
  });

  const response = await fetcher(url, { method: "POST", headers, body });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ text?: string }>;
    usage?: { input_tokens: number; output_tokens: number };
  };

  const content = data.content?.map((c) => c.text ?? "").join("") ?? "";
  const usage = data.usage
    ? { prompt: data.usage.input_tokens, completion: data.usage.output_tokens }
    : undefined;

  return { content, usage };
}

async function* streamAnthropic(
  req: ChatCompletionRequest,
  fetcher: typeof fetch
): AsyncGenerator<StreamChunk> {
  const url = `${req.provider.baseUrl.replace(/\/$/, "")}/messages`;
  const systemMsg = req.messages.find((m) => m.role === "system");
  const nonSystem = req.messages.filter((m) => m.role !== "system");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": req.provider.apiKey,
    "anthropic-version": "2023-06-01",
  };

  const body = JSON.stringify({
    model: req.model,
    max_tokens: req.maxTokens ?? 4096,
    system: systemMsg?.content,
    messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
  });

  const response = await fetcher(url, { method: "POST", headers, body });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const data = await callAnthropic(req, fetcher);
    yield { type: "text", content: data.content };
    yield { type: "done" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(trimmed.slice(6)) as {
          type?: string;
          delta?: { type?: string; text?: string };
          usage?: { input_tokens: number; output_tokens: number };
        };

        if (event.type === "content_block_delta" && event.delta?.text) {
          yield { type: "text", content: event.delta.text };
        }

        if (event.type === "message_delta" && event.usage) {
          yield { type: "usage", usage: { prompt: 0, completion: event.usage.output_tokens } };
        }
      } catch {
        // skip
      }
    }
  }

  yield { type: "done" };
}

// ─── Gemini ─────────────────────────────────────────────────────

async function callGemini(
  req: ChatCompletionRequest,
  fetcher: typeof fetch
): Promise<{ content: string; usage?: { prompt: number; completion: number } }> {
  const url = `${req.provider.baseUrl.replace(/\/$/, "")}/models/${req.model}:generateContent?key=${req.provider.apiKey}`;

  const contents = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemInstruction = req.messages.find((m) => m.role === "system");

  const body = JSON.stringify({
    contents,
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction.content }] } } : {}),
    generationConfig: { temperature: req.temperature ?? 0.7, maxOutputTokens: req.maxTokens ?? 4096 },
  });

  const response = await fetcher(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
  };

  const content =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const usage = data.usageMetadata
    ? { prompt: data.usageMetadata.promptTokenCount, completion: data.usageMetadata.candidatesTokenCount }
    : undefined;

  return { content, usage };
}

async function* streamGemini(
  req: ChatCompletionRequest,
  fetcher: typeof fetch
): AsyncGenerator<StreamChunk> {
  const url = `${req.provider.baseUrl.replace(/\/$/, "")}/models/${req.model}:streamGenerateContent?alt=sse&key=${req.provider.apiKey}`;

  const contents = req.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemInstruction = req.messages.find((m) => m.role === "system");

  const body = JSON.stringify({
    contents,
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction.content }] } } : {}),
    generationConfig: { temperature: req.temperature ?? 0.7, maxOutputTokens: req.maxTokens ?? 4096 },
  });

  const response = await fetcher(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const data = await callGemini(req, fetcher);
    yield { type: "text", content: data.content };
    yield { type: "done" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      try {
        const payload = JSON.parse(trimmed.slice(6)) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
        };
        const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
        if (text) yield { type: "text", content: text };
      } catch {
        // skip
      }
    }
  }

  yield { type: "done" };
}

// ─── Helpers ────────────────────────────────────────────────────

function buildUrl(provider: ProviderConfig, path: string): string {
  return `${provider.baseUrl.replace(/\/$/, "")}${path}`;
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
  const isMimoOmni = lower.includes("omni") || lower === "mimo-v2.5" || lower === "mimo-v2-omni";
  return {
    chat: !embedding && !isMimoTts,
    completion: !embedding && !isMimoTts,
    embedding,
    vision: lower.includes("vision") || lower.includes("gemini") || lower.includes("gpt-4") || isMimoOmni,
    toolCalling: !embedding && !local && !isMimoTts,
    jsonMode: !embedding && !isMimoTts,
    reasoning:
      lower.includes("reason") ||
      lower.includes("pro") ||
      lower.includes("sonnet") ||
      lower.includes("gpt") ||
      lower.includes("o3") ||
      lower.includes("k2") ||
      lower.includes("qwen3") ||
      (isMimo && (lower.includes("pro") || lower.includes("flash"))),
    local,
    fast: lower.includes("mini") || lower.includes("flash") || lower.includes("haiku") || lower.includes("turbo") || (isMimo && lower.includes("flash")),
    cheap:
      lower.includes("mini") || lower.includes("flash") || lower.includes("haiku") || lower.includes("turbo") || local,
    largeContext:
      lower.includes("32k") || lower.includes("128k") || lower.includes("gemini") || lower.includes("sonnet") || lower.includes("k2") || (isMimo && (lower.includes("pro") || lower.includes("omni") || lower === "mimo-v2.5")),
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


// ─── MiMo TTS ──────────────────────────────────────────────────

export interface MiMoTTSRequest {
  text: string;
  stylePrompt?: string;
  voice?: string;
  format?: "wav" | "mp3" | "pcm16";
  speed?: number;
  model?: string;
  provider: ProviderConfig;
}

export async function callMiMoTTS(
  req: MiMoTTSRequest,
  fetcher: typeof fetch = fetch
): Promise<{ audioBase64: string; format: string }> {
  // Use altBaseUrl if set, otherwise default baseUrl
  const baseUrl = req.provider.altBaseUrl || req.provider.baseUrl;
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "api-key": req.provider.apiKey,
    "Authorization": `Bearer ${req.provider.apiKey}`,
  };

  const messages: Array<{ role: string; content: string }> = [];

  // style prompt goes in user message (per MiMo docs: natural language style instructions)
  if (req.stylePrompt) {
    messages.push({ role: "user", content: req.stylePrompt });
  }

  // text to synthesize goes in assistant message
  messages.push({ role: "assistant", content: req.text });

  const audioConfig: Record<string, unknown> = {
    format: req.format ?? "wav",
    voice: req.voice ?? "mimo_default",
  };
  // Pass speed if specified (0.5 - 2.0)
  if (req.speed !== undefined && req.speed !== 1.0) {
    audioConfig.speed = req.speed;
  }

  const body = JSON.stringify({
    model: req.model ?? "mimo-v2.5-tts",
    messages,
    audio: audioConfig,
  });

  const response = await fetcher(url, {
    method: "POST",
    headers,
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

  return { audioBase64: audioData, format: req.format ?? "wav" };
}
