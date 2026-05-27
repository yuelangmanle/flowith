import { createReadme, createArchitectureDoc, createNextSteps } from "./artifacts";
import { researchOfficialDocs } from "./docsResearch";
import { createKnowledgeBase, createMemoryStore, upsertKnowledgeSource, writeMemory } from "./memoryKnowledge";
import type { AgentConfig, ApprovalRequest, Artifact, KnowledgeSource, MemoryItem } from "./types";

export interface ProjectGenerationInput {
  idea: string;
  stackOverride?: string;
  confirmPlan: boolean;
  approveDangerousActions: boolean;
}

export interface ProjectGenerationRun {
  id: string;
  status: "waiting-for-plan" | "waiting-for-approval" | "completed";
  clarifyingQuestions: string[];
  stack: { name: string; status: "official" | "experimental" };
  agents: AgentConfig[];
  approvals: ApprovalRequest[];
  artifacts: Artifact[];
  memoryItems: MemoryItem[];
  knowledgeSources: KnowledgeSource[];
  preview: { url: string; status: "ready" | "waiting" };
  fixLoopCount: number;
  logs: string[];
  files: Record<string, string>;
}

export async function runProjectGeneration(input: ProjectGenerationInput): Promise<ProjectGenerationRun> {
  const memory = createMemoryStore();
  const knowledge = createKnowledgeBase();
  const stackName = input.stackOverride ?? "Vite + React + TypeScript";
  const official = ["Vite + React + TypeScript", "Next.js + TypeScript + SQLite", "Agent Workflow App"].includes(stackName);
  const docsFinding = await researchOfficialDocs({
    topic: "Vite project setup",
    url: "https://vitejs.dev/guide/",
    fetcher: async () => new Response("Vite official guide: npm create vite, npm install, npm run dev.")
  });

  const source = upsertKnowledgeSource(knowledge, {
    id: "docs-vite-guide",
    kind: "official-docs",
    title: "Vite Guide",
    content: docsFinding.summary,
    metadata: {
      projectId: "project-ai-resume",
      sourceUrl: docsFinding.citation.url,
      fetchedAt: docsFinding.citation.fetchedAt,
      citationLocation: docsFinding.citation.location
    }
  });

  const projectMemory = writeMemory(memory, {
    type: "project",
    content: "AI 简历优化工具采用 Vite + React + TypeScript，第一版聚焦简历和岗位描述分析。",
    confirmed: true,
    source: { runId: "run-ai-resume", messageId: "plan-confirmed", toolCallId: "tool-docs-vite" },
    scope: "project"
  });

  const artifacts = [createReadme("AI Resume Optimizer"), createArchitectureDoc(), createNextSteps()];
  const files = {
    "package.json": JSON.stringify({
      type: "module",
      scripts: { dev: "vite --host 127.0.0.1" },
      dependencies: { "@vitejs/plugin-react": "latest", vite: "latest", typescript: "latest", react: "latest", "react-dom": "latest" },
      devDependencies: {}
    }, null, 2),
    "index.html": `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>AI Resume Optimizer</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
    "vite.config.ts": `import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react'; export default defineConfig({ plugins: [react()] });`,
    "tsconfig.json": JSON.stringify({ compilerOptions: { target: "ES2022", lib: ["DOM", "DOM.Iterable", "ES2022"], module: "ESNext", moduleResolution: "Node", jsx: "react-jsx", strict: true, noEmit: true }, include: ["src"] }, null, 2),
    "src/App.tsx": `export function App() { return <main style={{fontFamily:'system-ui',padding:32,maxWidth:960,margin:'0 auto'}}><h1>AI Resume Optimizer</h1><p>Paste a resume and job description to generate focused improvement suggestions.</p><section style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}><textarea style={{minHeight:220,padding:12}} placeholder="Resume" /><textarea style={{minHeight:220,padding:12}} placeholder="Job description" /></section><button style={{marginTop:16,padding:'10px 14px'}}>Generate suggestions</button></main>; }`,
    "src/main.tsx": `import { createRoot } from 'react-dom/client'; import { App } from './App'; createRoot(document.getElementById('root')!).render(<App />);`,
    "README.md": artifacts[0].content,
    "docs/architecture.md": artifacts[1].content
  };

  return {
    id: "run-ai-resume",
    status: input.approveDangerousActions ? "completed" : "waiting-for-approval",
    clarifyingQuestions: [
      "目标用户是求职者、HR，还是职业顾问？",
      "是否需要登录和历史记录？",
      "优化建议需要按岗位描述匹配吗？",
      "第一版是否接入真实模型 API？"
    ],
    stack: { name: stackName, status: official ? "official" : "experimental" },
    agents: createDefaultRunAgents(),
    approvals: [
      {
        id: "approval-install",
        type: "install-dependency",
        agent: "开发 Agent",
        reason: "安装 Vite/React 项目依赖。",
        command: "npm install",
        risk: "medium",
        status: input.approveDangerousActions ? "approved" : "pending"
      },
      {
        id: "approval-run",
        type: "execute-command",
        agent: "测试 Agent",
        reason: "启动本地 dev server 进行预览。",
        command: "npm run dev",
        risk: "medium",
        status: input.approveDangerousActions ? "approved" : "pending"
      }
    ],
    artifacts,
    memoryItems: [projectMemory],
    knowledgeSources: [source],
    preview: { url: "http://localhost:5173", status: "ready" },
    fixLoopCount: 1,
    logs: [
      "产品 Agent 完成需求澄清。",
      "架构 Agent 确认官方支持技术栈。",
      "开发 Agent 写入项目文件。",
      "测试 Agent 首次启动失败，补齐入口文件后通过。",
      "文档 Agent 生成 README 和架构说明。"
    ],
    files
  };
}

export function runRoundtable(input: { topic: string; rounds: number; accepted: boolean }) {
  const memory = createMemoryStore();
  const messages = [
    `产品 Agent：围绕“${input.topic}”先明确目标用户和核心收益。`,
    "架构 Agent：建议把模型接入隔离在 Model Gateway，避免 UI 直接依赖厂商 SDK。",
    "反方评审 Agent：需要控制第一版范围，先做可运行原型再扩展高级能力。"
  ].slice(0, Math.max(3, input.rounds));
  const summary = `结论：先把简历优化核心链路跑通，再加入历史记录、导出和多模型对比。`;
  const memoryItems = input.accepted
    ? [writeMemory(memory, {
        type: "scenario",
        content: summary,
        confirmed: true,
        source: { runId: "roundtable-1", messageId: "summary" },
        scope: "project"
      })]
    : [];
  return { messages, summary, memoryItems };
}

export function createDefaultRunAgents(): AgentConfig[] {
  return [
    ["product", "产品 Agent", ["memory", "docs"]],
    ["architecture", "架构 Agent", ["docs", "model-gateway"]],
    ["development", "开发 Agent", ["files", "commands"]],
    ["ui", "UI Agent", ["files", "preview"]],
    ["testing", "测试 Agent", ["commands", "preview"]],
    ["documentation", "文档 Agent", ["files", "artifacts"]],
    ["review", "评审 Agent", ["diff", "logs"]]
  ].map(([role, name, tools]) => ({ id: `agent-${role}`, role: role as AgentConfig["role"], name: name as string, tools: tools as string[] }));
}
