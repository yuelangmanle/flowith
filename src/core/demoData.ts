export const appMetadata = {
  name: "Multi-Agent Workspace",
  version: "0.3.0",
  primaryFlow: "multi-agent-collaboration",
  modules: [
    "workspace-shell",
    "model-gateway",
    "agent-orchestrator",
    "tool-runtime",
    "memory-system",
    "docs-research",
    "roundtable",
    "code-generation",
    "provider-settings",
    "streaming-chat",
    "voting-system",
    "custom-agents",
  ],
} as const;

export const defaultIdea =
  "帮我做一个 AI 简历优化 Web 应用，支持粘贴简历、输入岗位描述、生成优化建议。";

export const officialStacks = [
  {
    id: "vite-react",
    name: "Vite + React + TypeScript",
    status: "official" as const,
    description: "适合快速生成可预览的 Web 原型。",
  },
  {
    id: "next-fullstack",
    name: "Next.js + TypeScript + SQLite",
    status: "official" as const,
    description: "适合带 API 和轻量数据存储的全栈原型。",
  },
  {
    id: "agent-workflow",
    name: "Agent Workflow App",
    status: "official" as const,
    description: "适合生成带模型调用、工具调用和流程编排的小应用。",
  },
];

export const projectTemplates = [
  {
    id: "ai-resume",
    name: "AI 简历优化",
    idea: "帮我做一个 AI 简历优化 Web 应用",
    stack: "Vite + React + TypeScript",
    icon: "doc",
  },
  {
    id: "chat-app",
    name: "聊天应用",
    idea: "帮我做一个实时聊天 Web 应用",
    stack: "Next.js + TypeScript",
    icon: "chat",
  },
  {
    id: "dashboard",
    name: "数据面板",
    idea: "帮我做一个数据可视化面板",
    stack: "Vite + React + TypeScript",
    icon: "chart",
  },
  {
    id: "todo-app",
    name: "任务管理",
    idea: "帮我做一个任务管理 Web 应用",
    stack: "Vite + React + TypeScript",
    icon: "✅",
  },
  {
    id: "api-service",
    name: "API 服务",
    idea: "帮我做一个 RESTful API 服务",
    stack: "Next.js + TypeScript",
    icon: "🔌",
  },
  {
    id: "landing-page",
    name: "落地页",
    idea: "帮我做一个产品落地页",
    stack: "Vite + React + TypeScript",
    icon: "rocket",
  },
];

export const roundtableTopics = [
  { id: "web-perf", name: "Web 性能优化策略", icon: "⚡" },
  { id: "arch-design", name: "系统架构设计方案", icon: "🏗️" },
  { id: "tech-stack", name: "技术栈选型讨论", icon: "🔧" },
  { id: "api-design", name: "API 设计最佳实践", icon: "📐" },
];
