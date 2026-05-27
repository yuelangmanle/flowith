export const appMetadata = {
  name: "Multi-Agent Workspace",
  primaryFlow: "project-generation",
  modules: [
    "workspace-shell",
    "model-gateway",
    "agent-orchestrator",
    "tool-runtime",
    "memory-rag",
    "docs-research",
    "roundtable"
  ]
} as const;

export const defaultIdea =
  "帮我做一个 AI 简历优化 Web 应用，支持粘贴简历、输入岗位描述、生成优化建议。";

export const officialStacks = [
  {
    id: "vite-react",
    name: "Vite + React + TypeScript",
    status: "official" as const,
    description: "适合快速生成可预览的 Web 原型。"
  },
  {
    id: "next-fullstack",
    name: "Next.js + TypeScript + SQLite",
    status: "official" as const,
    description: "适合带 API 和轻量数据存储的全栈原型。"
  },
  {
    id: "agent-workflow",
    name: "Agent Workflow App",
    status: "official" as const,
    description: "适合生成带模型调用、工具调用和流程编排的小应用。"
  }
];

export const defaultAgents = [
  "主持 Agent",
  "产品 Agent",
  "架构 Agent",
  "开发 Agent",
  "UI Agent",
  "测试 Agent",
  "文档 Agent",
  "评审 Agent"
];

