import type { ToolDefinition, ToolCallResult, ToolType, ApprovalRequest } from "./types";

// ─── Tool Definitions ───────────────────────────────────────────

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "read_file",
    description: "读取工作区中的文件内容",
    type: "read-file",
    parameters: { path: "string" },
    riskLevel: "low",
    requiresApproval: false,
  },
  {
    name: "write_file",
    description: "写入或创建文件到工作区",
    type: "write-file",
    parameters: { path: "string", content: "string" },
    riskLevel: "low",
    requiresApproval: false,
  },
  {
    name: "list_files",
    description: "列出工作区中的文件",
    type: "list-files",
    parameters: { directory: "string" },
    riskLevel: "low",
    requiresApproval: false,
  },
  {
    name: "run_command",
    description: "在工作区执行 Shell 命令",
    type: "run-command",
    parameters: { command: "string" },
    riskLevel: "high",
    requiresApproval: true,
  },
  {
    name: "fetch_url",
    description: "获取网络资源（如官方文档）",
    type: "fetch-url",
    parameters: { url: "string" },
    riskLevel: "medium",
    requiresApproval: true,
  },
  {
    name: "search_knowledge",
    description: "在知识库中搜索信息",
    type: "search-knowledge",
    parameters: { query: "string" },
    riskLevel: "low",
    requiresApproval: false,
  },
  {
    name: "read_memory",
    description: "读取 Agent 记忆",
    type: "read-memory",
    parameters: { query: "string", layer: "string" },
    riskLevel: "low",
    requiresApproval: false,
  },
  {
    name: "write_memory",
    description: "写入 Agent 记忆",
    type: "write-memory",
    parameters: { content: "string", type: "string", importance: "number" },
    riskLevel: "low",
    requiresApproval: false,
  },
  {
    name: "browse_docs",
    description: "查阅官方文档获取 API 信息",
    type: "browse-docs",
    parameters: { topic: "string", url: "string" },
    riskLevel: "low",
    requiresApproval: false,
  },
];

// ─── Tool Registry ──────────────────────────────────────────────

export function getToolByName(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}

export function getToolsForAgent(agentTools: string[]): ToolDefinition[] {
  return TOOL_DEFINITIONS.filter((t) =>
    agentTools.some((at) => t.name.includes(at) || t.type.includes(at))
  );
}

export function getAllTools(): ToolDefinition[] {
  return [...TOOL_DEFINITIONS];
}

// ─── Risk Assessment ────────────────────────────────────────────

export function assessRisk(tool: ToolDefinition, args: Record<string, unknown>): "low" | "medium" | "high" {
  if (tool.type === "run-command") {
    const cmd = String(args.command ?? "").toLowerCase();
    if (/rm\s+-rf|sudo|chmod|mkfs|dd\s+if/.test(cmd)) return "high";
    if (/npm\s+install|pip\s+install|yarn\s+add/.test(cmd)) return "medium";
    return "medium";
  }
  if (tool.type === "fetch-url") {
    const url = String(args.url ?? "");
    if (isOfficialUrl(url)) return "low";
    return "medium";
  }
  return tool.riskLevel;
}

function isOfficialUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    const officialHosts = [
      "openai.com", "anthropic.com", "ai.google.dev", "cloud.google.com",
      "deepseek.com", "dashscope.aliyuncs.com", "moonshot.cn", "ollama.com",
      "vitejs.dev", "react.dev", "github.com", "npmjs.com", "pypi.org",
    ];
    return officialHosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

// ─── Dangerous Command Detection ────────────────────────────────

export function isDangerousCommand(command: string): boolean {
  const normalized = command.toLowerCase();
  return [
    /rm\s+-rf\s+\//,
    /curl.+\|\s*(sh|bash)/,
    /wget.+\|\s*(sh|bash)/,
    />\s*\/dev\/(sda|disk)/,
    /sudo\s+/,
    /chmod\s+-r\s+777\s+\//,
    /mkfs/,
    /dd\s+if=/,
  ].some((pattern) => pattern.test(normalized));
}

// ─── Tool Execution ─────────────────────────────────────────────

export function createToolCallId(): string {
  return `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createApprovalRequest(
  tool: ToolDefinition,
  agentId: string,
  args: Record<string, unknown>
): ApprovalRequest {
  const risk = assessRisk(tool, args);
  return {
    id: `approval-${Date.now()}`,
    type: tool.type === "run-command" ? "execute-command" :
          tool.type === "fetch-url" ? "network" :
          tool.type === "read-file" ? "sensitive-read" : "execute-command",
    agent: agentId,
    reason: `${tool.description}: ${JSON.stringify(args).slice(0, 100)}`,
    command: args.command as string | undefined,
    url: args.url as string | undefined,
    path: args.path as string | undefined,
    risk,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

export function formatToolResult(result: ToolCallResult): string {
  if (result.error) return `[错误] ${result.error}`;
  if (result.status === "approval-required") return `[需要审批] ${result.name}`;
  return result.result ?? "[无输出]";
}

export function compressOutput(output: string, maxLength = 4000): string {
  if (output.length <= maxLength) return output;
  return `${output.slice(0, maxLength)}\n...[截断 ${output.length - maxLength} 字符]`;
}
