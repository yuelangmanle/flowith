import type {
  CodeGenPhase,
  CodeGenRun,
  AgentConfig,
  Artifact,
  ApprovalRequest,
  Conversation,
  ChatMessage,
  ProviderConfig,
  StreamChunk,
  MessageRole,
} from "./types";
import { getAgentsForProjectGeneration, getAgentById } from "./agentConfig";
import { streamChatCompletion } from "./modelGateway";

// ─── Phase Definitions ──────────────────────────────────────────

interface PhaseDefinition {
  phase: CodeGenPhase;
  name: string;
  agentRole: string;
  description: string;
  nextPhase: CodeGenPhase | null;
}

const PHASES: PhaseDefinition[] = [
  {
    phase: "requirements",
    name: "需求分析",
    agentRole: "product",
    description: "分析用户需求，提出澄清问题，输出需求文档",
    nextPhase: "design",
  },
  {
    phase: "design",
    name: "技术设计",
    agentRole: "architecture",
    description: "选择技术栈，设计架构，输出技术方案",
    nextPhase: "generation",
  },
  {
    phase: "generation",
    name: "代码生成",
    agentRole: "development",
    description: "根据技术方案生成项目文件",
    nextPhase: "testing",
  },
  {
    phase: "testing",
    name: "测试验证",
    agentRole: "testing",
    description: "运行项目，发现 bug，验证功能",
    nextPhase: "fixing",
  },
  {
    phase: "fixing",
    name: "修复问题",
    agentRole: "development",
    description: "修复测试发现的问题",
    nextPhase: "documentation",
  },
  {
    phase: "documentation",
    name: "文档生成",
    agentRole: "documentation",
    description: "生成 README、架构文档、使用说明",
    nextPhase: "review",
  },
  {
    phase: "review",
    name: "最终审查",
    agentRole: "review",
    description: "审查全部产出，输出审查报告",
    nextPhase: "completed",
  },
  {
    phase: "completed",
    name: "完成",
    agentRole: "",
    description: "项目生成完成",
    nextPhase: null,
  },
];

export function getPhaseDefinition(phase: CodeGenPhase): PhaseDefinition | undefined {
  return PHASES.find((p) => p.phase === phase);
}

export function getAllPhases(): PhaseDefinition[] {
  return [...PHASES];
}

// ─── Pipeline Creation ──────────────────────────────────────────

export function createCodeGenRun(
  projectId: string,
  idea: string,
  techStack: string
): CodeGenRun {
  return {
    id: `codegen-${Date.now()}`,
    projectId,
    idea,
    techStack,
    phase: "requirements",
    phaseHistory: [],
    fixAttempts: 0,
    maxFixAttempts: 3,
    status: "running",
    approvals: [],
    artifacts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ─── Phase Execution ────────────────────────────────────────────

function buildPhasePrompt(run: CodeGenRun, phase: CodeGenPhase): string {
  const def = getPhaseDefinition(phase);
  if (!def) return "";

  const context = run.phaseHistory
    .map((h) => `[${h.phase}] ${h.output?.slice(0, 500) ?? "无输出"}`)
    .join("\n\n");

  switch (phase) {
    case "requirements":
      return `用户的想法: ${run.idea}\n\n请作为产品经理分析这个需求：\n1. 提出 3-5 个澄清问题\n2. 列出核心功能清单\n3. 定义 MVP 范围\n4. 输出结构化需求文档`;
    case "design":
      return `需求文档:\n${context}\n\n技术栈: ${run.techStack}\n\n请作为架构师设计技术方案：\n1. 确认技术栈选择\n2. 设计系统架构\n3. 定义核心 API\n4. 列出关键依赖`;
    case "generation":
      return `技术方案:\n${context}\n\n请生成完整的项目代码文件。每个文件用以下格式：\n\n\`\`\`文件路径\n文件内容\n\`\`\`\n\n至少包含: package.json, index.html, 源代码入口, 主要组件`;
    case "testing":
      return `已生成的代码:\n${context}\n\n请作为测试工程师检查代码：\n1. 检查语法错误\n2. 检查导入是否正确\n3. 检查逻辑漏洞\n4. 列出需要修复的问题`;
    case "fixing":
      return `测试报告:\n${context}\n\n请修复上述问题，给出修改后的完整代码。`;
    case "documentation":
      return `项目信息:\n想法: ${run.idea}\n技术栈: ${run.techStack}\n\n请生成：\n1. README.md (含安装、运行、功能说明)\n2. 架构简述\n3. 后续建议`;
    case "review":
      return `全部产出:\n${context}\n\n请作为评审专家审查：\n1. 代码质量\n2. 功能完整性\n3. 文档质量\n4. 改进建议`;
    default:
      return "";
  }
}

export async function* executePhase(
  run: CodeGenRun,
  phase: CodeGenPhase,
  provider: ProviderConfig,
  model: string
): AsyncGenerator<StreamChunk> {
  const def = getPhaseDefinition(phase);
  if (!def) {
    yield { type: "error", error: `Unknown phase: ${phase}` };
    return;
  }

  const agent = getAgentById(`agent-${def.agentRole === "development" ? "developer" : def.agentRole}`);
  if (!agent && phase !== "completed") {
    yield { type: "error", error: `No agent for phase: ${phase}` };
    return;
  }

  run.phase = phase;
  run.phaseHistory.push({
    phase,
    startedAt: new Date().toISOString(),
    agentId: agent?.id ?? "",
  });

  const prompt = buildPhasePrompt(run, phase);
  const messages: Array<{ role: string; content: string }> = [];

  if (agent?.systemPrompt) {
    messages.push({ role: "system", content: agent.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  yield {
    type: "text",
    content: "",
    agentId: agent?.id,
    agentName: `${def.name}阶段`,
    agentColor: agent?.color,
    agentAvatar: agent?.avatar,
  };

  let fullContent = "";
  try {
    for await (const chunk of streamChatCompletion({
      provider,
      model,
      messages,
      stream: true,
    })) {
      if (chunk.type === "text" && chunk.content) {
        fullContent += chunk.content;
        yield {
          type: "text",
          content: chunk.content,
          agentId: agent?.id,
          agentName: `${def.name}阶段`,
          agentColor: agent?.color,
          agentAvatar: agent?.avatar,
        };
      }
    }
  } catch (err) {
    fullContent = `[${def.name} 失败: ${err instanceof Error ? err.message : String(err)}]`;
    yield { type: "error", error: fullContent };
  }

  // 完成当前阶段
  const lastPhase = run.phaseHistory[run.phaseHistory.length - 1];
  if (lastPhase) {
    lastPhase.completedAt = new Date().toISOString();
    lastPhase.output = fullContent;
  }

  // 提取生成的文件
  if (phase === "generation" || phase === "fixing") {
    const files = extractFiles(fullContent);
    const projectArtifact: Artifact = {
      id: `artifact-${Date.now()}`,
      kind: "project",
      title: "Generated Project",
      content: JSON.stringify(files, null, 2),
    };
    run.artifacts.push(projectArtifact);
  }

  // 文档阶段
  if (phase === "documentation") {
    run.artifacts.push({
      id: `artifact-doc-${Date.now()}`,
      kind: "readme",
      title: "README",
      content: fullContent,
    });
  }

  run.updatedAt = new Date().toISOString();
  yield { type: "done" };
}

// ─── Full Pipeline ──────────────────────────────────────────────

export async function* runFullPipeline(
  run: CodeGenRun,
  provider: ProviderConfig,
  model: string
): AsyncGenerator<StreamChunk> {
  const phases: CodeGenPhase[] = ["requirements", "design", "generation", "testing", "documentation", "review"];

  for (const phase of phases) {
    yield* executePhase(run, phase, provider, model);

    // 如果是 testing 阶段发现问题且未超过最大修复次数，进入 fixing
    if (phase === "testing" && run.fixAttempts < run.maxFixAttempts) {
      const testOutput = run.phaseHistory.find((h) => h.phase === "testing")?.output ?? "";
      if (testOutput.includes("问题") || testOutput.includes("错误") || testOutput.includes("bug")) {
        run.fixAttempts++;
        yield* executePhase(run, "fixing", provider, model);
        // 修复后重新测试
        yield* executePhase(run, "testing", provider, model);
      }
    }
  }

  run.status = "completed";
  run.phase = "completed";
  run.updatedAt = new Date().toISOString();
}

// ─── Helpers ────────────────────────────────────────────────────

function extractFiles(content: string): Record<string, string> {
  const files: Record<string, string> = {};
  const regex = /```(?:文件路径[:：]?)?\s*([^\n]+)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const path = match[1].trim();
    const fileContent = match[2].trim();
    if (path && fileContent && !path.startsWith("text") && !path.startsWith("json")) {
      files[path] = fileContent;
    }
  }
  return files;
}

export function getProgressPercentage(run: CodeGenRun): number {
  const totalPhases = 7; // requirements through review
  const completedPhases = run.phaseHistory.filter((h) => h.completedAt).length;
  return Math.round((completedPhases / totalPhases) * 100);
}
