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
  // TTS settings
  ttsEnabled?: boolean;
  ttsModel?: string;             // mimo-v2.5-tts / mimo-v2.5-tts-voicedesign / mimo-v2.5-tts-voiceclone
  ttsVoice?: string;             // 内置音色 ID
  ttsFormat?: "wav" | "mp3" | "pcm16";
  ttsSpeed?: number;             // 0.5 - 2.0
  ttsStylePrompt?: string;       // 自然语言风格指令
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
  lastUsedAt?: string;
  confirmed: boolean;
  scope: "project" | "global";
  retention: "keep" | "expire" | "delete";
  importance: number; // 0-1, 用于衰减
  tags: string[];
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
  usage?: { prompt: number; completion: number };
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
  providerId?: string;
  model?: string;             // mimo-v2.5-tts / mimo-v2.5-tts-voicedesign / mimo-v2.5-tts-voiceclone
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
  voice?: string;           // 音色 ID
  speed?: number;           // 0.5 - 2.0
  stylePrompt?: string;     // 风格指令
  model?: string;           // tts model
  autoSpeak?: boolean;      // 自动朗读 AI 回复
}

// ─── Docs Research ──────────────────────────────────────────────

export interface DocsResearchResult {
  url: string;
  title: string;
  summary: string;
  official: boolean;
  fetchedAt: string;
  relevanceScore: number;
}
