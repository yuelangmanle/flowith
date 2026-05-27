export type ProviderType =
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "qwen"
  | "moonshot"
  | "ollama"
  | "openai-compatible";

export type AgentRole =
  | "product"
  | "architecture"
  | "development"
  | "ui"
  | "testing"
  | "documentation"
  | "review"
  | "moderator"
  | "critic";

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

export interface SourceRef {
  runId?: string;
  messageId?: string;
  toolCallId?: string;
  artifactId?: string;
}

export type MemoryType = "raw" | "fact" | "scenario" | "persona" | "project";

export interface MemoryItem {
  id: string;
  type: MemoryType;
  content: string;
  confidence: number;
  source: SourceRef;
  createdAt: string;
  lastUsedAt?: string;
  confirmed: boolean;
  scope: "project" | "global";
  retention: "keep" | "expire" | "delete";
}

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

export interface ApprovalRequest {
  id: string;
  type: "install-dependency" | "execute-command" | "network" | "delete-file" | "database-migration" | "sensitive-read";
  agent: string;
  reason: string;
  command?: string;
  risk: "medium" | "high";
  status: "pending" | "approved" | "denied";
}

export interface Artifact {
  id: string;
  kind: "project" | "readme" | "architecture" | "report" | "next-steps" | "roundtable";
  title: string;
  content: string;
}

export interface AgentConfig {
  id: string;
  role: AgentRole;
  name: string;
  model?: string;
  tools: string[];
}

