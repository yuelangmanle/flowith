// ─── Provider & Model ───────────────────────────────────────────

export type ProviderType =
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "qwen"
  | "moonshot"
  | "ollama"
  | "openai-compatible"
  | "xiaomi-mimo";

// ─── TTS Provider ───────────────────────────────────────────────

export type TTSProviderType = "mimo-tts" | "openai-tts" | "edge-tts" | "fish-audio" | "custom-tts";

export interface TTSProviderConfig {
  id: string;
  type: TTSProviderType;
  name: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  // Model / voice defaults
  defaultModel?: string;
  defaultVoice?: string;
  defaultFormat?: "wav" | "mp3" | "pcm16";
  defaultSpeed?: number;          // 0.5 - 2.0
  defaultStylePrompt?: string;
  // MiMo-specific
  mimoAltBaseUrl?: string;        // token-plan-cn endpoint
  // OpenAI-specific
  openaiInstructions?: string;    // system-level TTS instructions
  // Fish Audio-specific
  fishReferenceId?: string;       // reference audio ID for voice cloning
  // Custom endpoint
  customHeaders?: Record<string, string>;
  requestTemplate?: string;       // JSON template with {{text}}, {{voice}}, etc.
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  supportsModelList: boolean;
  organization?: string;
  region?: string;
  defaultModel?: string;
  modelsDiscovered?: number;
  // MiMo-specific
  altBaseUrl?: string;           // 第二个 URL (e.g. token-plan-cn)
  webSearchEnabled?: boolean;    // 联网搜索开关
  webSearchMaxKeyword?: number;  // 最大搜索关键词数
  // DeepSeek-specific
  reasoningEffort?: "low" | "medium" | "high";
  // Qwen-specific
  enableSearch?: boolean;        // 通义千问联网搜索
  enableThinking?: boolean;      // qwen3 思考模式
  // Moonshot-specific
  moonshotWebSearch?: boolean;   // Kimi 联网搜索
}

export interface ModelCapabilities {
  chat?: boolean;
  completion?: boolean;
  embedding?: boolean;
  vision?: boolean;
  toolCalling?: boolean;
  jsonMode?: boolean;
  reasoning?: boolean;
  local?: boolean;
  fast?: boolean;
  cheap?: boolean;
  largeContext?: boolean;
}

export interface ModelConfig {
  id: string;
  providerId: string;
  name: string;
  capabilities: ModelCapabilities;
  stale?: boolean;
  lastError?: string;
  source?: "custom" | "discovered";
}

// ─── Agent ──────────────────────────────────────────────────────

export type AgentRole =
  | "product"
  | "architecture"
  | "development"
  | "ui"
  | "testing"
  | "documentation"
  | "review"
  | "moderator"
  | "critic"
  | "coder"
  | "researcher";

export interface AgentConfig {
  id: string;
  role: AgentRole;
  name: string;
  avatar: string;
  avatarType: "emoji" | "image";
  goal: string;
  backstory: string;
  systemPrompt: string;
  model?: string;
  providerId?: string;
  tools: string[];
  color: string;
  custom?: boolean;
}

// ─── Orchestration ──────────────────────────────────────────────

export type OrchestrationMode = "sequential" | "hierarchical" | "roundtable";

export interface OrchestrationPlan {
  id: string;
  mode: OrchestrationMode;
  topic: string;
  agentIds: string[];
  moderatorId?: string;
  maxRounds: number;
  status: "pending" | "running" | "completed" | "failed";
  currentRound: number;
  currentAgentIndex: number;
  createdAt: string;
}

// ─── Conversation & Message ─────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  reasoningContent?: string;  // MiMo/DeepSeek reasoning content (must be passed back in multi-turn)
  imageData?: string;        // base64 data URL for first attached image
  additionalImages?: string[]; // remaining images
  attachedFiles?: Array<{ name: string; type: string; size: number; content?: string }>; // attached files with extracted text
  agentId?: string;
  agentName?: string;
  agentColor?: string;
  agentAvatar?: string;
  toolCalls?: ToolCallResult[];
  createdAt: string;
  streaming?: boolean;
  error?: string;
  tokenUsage?: { prompt: number; completion: number };
  round?: number;
}

export interface Conversation {
  id: string;
  title: string;
  type: "chat" | "group-chat" | "project-generation" | "roundtable";
  agentIds: string[];
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  pinned?: boolean;
  branchedFrom?: { convId: string; messageId: string };
}

// ─── Tool ───────────────────────────────────────────────────────

export type ToolType =
  | "read-file"
  | "write-file"
  | "list-files"
  | "run-command"
  | "fetch-url"
  | "search-knowledge"
  | "read-memory"
  | "write-memory"
  | "browse-docs";

export interface ToolDefinition {
  name: string;
  description: string;
  type: ToolType;
  parameters: Record<string, unknown>;
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
}

export interface ToolCallResult {
  id: string;
  name: string;
  type: ToolType;
  arguments: string;
  result?: string;
  error?: string;
  status: "pending" | "running" | "completed" | "failed" | "approval-required";
  agentId?: string;
  startTime?: string;
  endTime?: string;
}

export interface ToolCallRecord {
  id: string;
  type: string;
  command?: string;
  path?: string;
  status: "completed" | "approval-required" | "failed";
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  workingDirectory: string;
  timeoutMs: number;
  createdAt: string;
}

// ─── Approval ───────────────────────────────────────────────────

export type ApprovalType =
  | "install-dependency"
  | "execute-command"
  | "network"
  | "delete-file"
  | "database-migration"
  | "sensitive-read";

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  agent: string;
  reason: string;
  command?: string;
  url?: string;
  path?: string;
  risk: "low" | "medium" | "high";
  status: "pending" | "approved" | "denied";
  createdAt: string;
  conversationId?: string;
  messageId?: string;
}

// ─── Voting ─────────────────────────────────────────────────────

export interface VoteOption {
  id: string;
  label: string;
  description?: string;
  voterIds: string[];
}

export interface VoteSession {
  id: string;
  topic: string;
  options: VoteOption[];
  status: "active" | "closed";
  createdAt: string;
  closedAt?: string;
  winnerId?: string;
  conversationId: string;
}

// ─── Structured Report ──────────────────────────────────────────

export interface ReportSection {
  title: string;
  content: string;
  agentId?: string;
}

export interface StructuredReport {
  id: string;
  title: string;
  topic: string;
  sections: ReportSection[];
  conclusion: string;
  agentIds: string[];
  conversationId: string;
  createdAt: string;
}

// ─── Artifact & Memory ──────────────────────────────────────────

export interface Artifact {
  id: string;
  kind: "project" | "readme" | "architecture" | "report" | "next-steps" | "roundtable";
  title: string;
  content: string;
}

export interface SourceRef {
  runId?: string;
  messageId?: string;
  toolCallId?: string;
  artifactId?: string;
}

export type MemoryType = "raw" | "fact" | "scenario" | "persona" | "project";

// L1: 对话记忆 (短期, 内存)
// L2: 工作记忆 (任务级, 内存)
// L3: 事实记忆 (长期, 持久化)
// L4: 情景记忆 (长期, 持久化)
export type MemoryLayer = "L1-conversation" | "L2-working" | "L3-fact" | "L4-episodic";

export interface MemoryItem {
  id: string;
  type: MemoryType;
  layer: MemoryLayer;
  content: string;
  confidence: number;
  source: SourceRef;
  createdAt: string;
  updatedAt?: string;
  lastUsedAt?: string;
  confirmed: boolean;
  scope: "project" | "global";
  retention: "keep" | "expire" | "delete";
  importance: number; // 0-1, 用于衰减
  tags: string[];
  version: number;
  relatedIds?: string[];
  sourceConversationId?: string;
  sourceMessageId?: string;
  hitCount?: number;
}

export interface MemoryStats {
  totalItems: number;
  l1Count: number;
  l2Count: number;
  l3Count: number;
  l4Count: number;
  recentAdditions: number; // last 7 days
  totalHits: number;
}

// ─── Knowledge ──────────────────────────────────────────────────

export interface KnowledgeSource {
  id: string;
  kind: "official-docs" | "project-doc" | "code" | "report" | "roundtable";
  title: string;
  content: string;
  metadata: {
    projectId?: string;
    sourceUrl?: string;
    fetchedAt?: string;
    documentVersion?: string;
    apiVersion?: string;
    citationLocation?: string;
  };
}

// ─── Project & Workspace ────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string;
  techStack: string;
  createdAt: string;
  updatedAt: string;
  workspacePath?: string;
  files: Record<string, string>;
  conversationIds: string[];
  status: "planning" | "generating" | "running" | "completed" | "failed";
}

// ─── Code Generation Pipeline ───────────────────────────────────

export type CodeGenPhase =
  | "requirements"
  | "design"
  | "generation"
  | "testing"
  | "fixing"
  | "documentation"
  | "review"
  | "completed";

export interface CodeGenRun {
  id: string;
  projectId: string;
  idea: string;
  techStack: string;
  phase: CodeGenPhase;
  phaseHistory: Array<{
    phase: CodeGenPhase;
    startedAt: string;
    completedAt?: string;
    agentId: string;
    output?: string;
  }>;
  fixAttempts: number;
  maxFixAttempts: number;
  status: "running" | "completed" | "failed" | "waiting-approval";
  approvals: ApprovalRequest[];
  artifacts: Artifact[];
  createdAt: string;
  updatedAt: string;
}

// ─── App State ──────────────────────────────────────────────────

export type AppView =
  | "chat"
  | "projects"
  | "settings"
  | "roundtable"
  | "approvals"
  | "knowledge"
  | "workspace"
  | "codegen"
  | "agents";

// ─── Streaming ──────────────────────────────────────────────────

export interface StreamChunk {
  type: "text" | "tool-call" | "error" | "done" | "usage";
  content?: string;
  toolCall?: Partial<ToolCallResult>;
  error?: string;
  usage?: { prompt: number; completion: number; cachedTokens?: number; cacheCreationTokens?: number };
  agentId?: string;
  agentName?: string;
  agentColor?: string;
  agentAvatar?: string;
  round?: number;
}

// ─── TTS ────────────────────────────────────────────────────────

export interface TTSRequest {
  text: string;
  stylePrompt?: string;       // 自然语言风格描述
  voice?: string;             // 音色 ID
  format?: "wav" | "mp3" | "pcm16";
  speed?: number;
  ttsProviderId?: string;     // TTS provider ID (not chat provider)
  model?: string;
  instructions?: string;      // OpenAI TTS instructions
}

export interface TTSResponse {
  audioBase64: string;
  format: string;
  duration?: number;
}

// ─── API Request / Response ─────────────────────────────────────

export interface ChatRequest {
  conversationId: string;
  message: string;
  model?: string;
  providerId?: string;
  stream?: boolean;
}

export interface DiscoverModelsRequest {
  providerId: string;
}

export interface TestProviderRequest {
  providerId: string;
}

export interface TestProviderResponse {
  ok: boolean;
  modelCount: number;
  error?: string;
  latencyMs?: number;
}

// ─── Multi-Agent Group Chat ─────────────────────────────────────

export interface GroupChatConfig {
  id: string;
  name: string;
  agentIds: string[];
  turnOrder: "round-robin" | "random" | "moderator-picks";
  maxTurnsPerAgent?: number;
  topic?: string;
}

// ─── Agent Model Selection ──────────────────────────────────────

export interface AgentModelConfig {
  agentId: string;
  providerId: string;
  modelId: string;
  useGlobal?: boolean;  // true = use global default
}

// ─── Per-Agent TTS Config ──────────────────────────────────────

export interface AgentTTSConfig {
  agentId: string;
  enabled: boolean;
  ttsProviderId?: string;   // which TTS provider to use
  voice?: string;           // 音色 ID
  speed?: number;           // 0.5 - 2.0
  stylePrompt?: string;     // 风格指令
  model?: string;           // tts model override
  autoSpeak?: boolean;      // 自动朗读 AI 回复
}

// ─── Docs Research ──────────────────────────────────────────────



// ─── Skill ──────────────────────────────────────────────────────

export interface Skill {
  id: string;
  name: string;
  nameZh: string;              // 中文名称
  description: string;         // 英文描述
  descriptionZh: string;       // 中文描述（必填）
  author: string;
  repo?: string;               // GitHub repo URL
  category: string;
  categoryZh: string;          // 中文分类
  stars?: number;
  installed: boolean;
  source: "builtin" | "github" | "local";  // 来源
  localPath?: string;          // 本地导入路径
  content?: string;            // skill 内容（SKILL.md 或自定义）
  capabilities?: string[];     // 能力标签，如 ["代码生成", "文档分析"]
  useCases?: string[];         // 使用场景
  installedAt?: string;
}
export interface DocsResearchResult {
  url: string;
  title: string;
  summary: string;
  official: boolean;
  fetchedAt: string;
  relevanceScore: number;
}


// ─── Token Budget & Context ─────────────────────────────────────

export interface TokenBudget {
  maxInput: number;
  maxOutput: number;
  reservedForOverhead: number;
}

export interface CompressionStats {
  originalTokens: number;
  compressedTokens: number;
  savedTokens: number;
  compressionRatio: number;  // 0-1, lower = more compression
  imagesStripped: number;
  filesStripped: number;
  messagesTruncated: number;
  summariesCreated: number;
}

/** Model context window sizes (tokens). Unknown models default to 8192. */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // OpenAI
  "gpt-4o": 128_000,
  "gpt-4o-mini": 128_000,
  "gpt-4.1": 1_048_576,
  "gpt-4.1-mini": 1_048_576,
  "gpt-4.1-nano": 1_048_576,
  "o3": 200_000,
  "o3-mini": 200_000,
  "o4-mini": 200_000,
  // Anthropic
  "claude-sonnet-4-20250514": 200_000,
  "claude-opus-4-20250514": 200_000,
  "claude-3-5-sonnet-20241022": 200_000,
  "claude-3-5-haiku-20241022": 200_000,
  "claude-3-opus-20240229": 200_000,
  // DeepSeek
  "deepseek-chat": 64_000,
  "deepseek-reasoner": 64_000,
  // Qwen
  "qwen-max": 131_072,
  "qwen-plus": 131_072,
  "qwen-turbo": 131_072,
  "qwen3-235b-a22b": 131_072,
  // Moonshot
  "moonshot-v1-128k": 131_072,
  "moonshot-v1-32k": 32_768,
  "moonshot-v1-8k": 8_192,
  // Gemini
  "gemini-2.0-flash": 1_048_576,
  "gemini-2.5-pro": 1_048_576,
  "gemini-2.5-flash": 1_048_576,
  // MiMo
  "MiMo-GPT": 32_768,
};

/** Default context window for unknown models */
export const DEFAULT_CONTEXT_WINDOW = 8_192;

/** Lookup context window for a model ID (fuzzy match by prefix) */
export function getModelContextWindow(modelId: string): number {
  const lower = modelId.toLowerCase();
  // Exact match
  for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (lower === key.toLowerCase()) return value;
  }
  // Prefix match
  for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (lower.startsWith(key.toLowerCase())) return value;
  }
  // Partial match (e.g. "gpt-4o-2024-08-06" matches "gpt-4o")
  if (lower.includes("gpt-4o") || lower.includes("gpt-4.1")) return 128_000;
  if (lower.includes("o3") || lower.includes("o4")) return 200_000;
  if (lower.includes("claude")) return 200_000;
  if (lower.includes("deepseek")) return 64_000;
  if (lower.includes("qwen")) return 131_072;
  if (lower.includes("gemini")) return 1_048_576;
  if (lower.includes("moonshot")) return 131_072;
  return DEFAULT_CONTEXT_WINDOW;
}
