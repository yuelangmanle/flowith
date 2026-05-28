import type {
  AgentConfig,
  OrchestrationMode,
  OrchestrationPlan,
  Conversation,
  ChatMessage,
  ProviderConfig,
  StreamChunk,
  MessageRole,
} from "./types";
import { getAgentById, getAgentsForProjectGeneration, getAgentsForRoundtable } from "./agentConfig";
import { streamChatCompletion } from "./modelGateway";

// ─── Orchestration Plan ─────────────────────────────────────────

export function createOrchestrationPlan(
  mode: OrchestrationMode,
  topic: string,
  agentIds: string[],
  maxRounds: number = 3
): OrchestrationPlan {
  return {
    id: `plan-${Date.now()}`,
    mode,
    topic,
    agentIds,
    maxRounds,
    status: "pending",
    currentRound: 0,
    currentAgentIndex: 0,
    createdAt: new Date().toISOString(),
  };
}

// ─── Sequential Mode ────────────────────────────────────────────

export async function* runSequential(
  agents: AgentConfig[],
  topic: string,
  provider: ProviderConfig,
  model: string,
  conversation: Conversation
): AsyncGenerator<StreamChunk> {
  let context = topic;

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i];
    const messages: Array<{ role: string; content: string }> = [];

    if (agent.systemPrompt) {
      messages.push({ role: "system", content: agent.systemPrompt });
    }

    const prompt = i === 0
      ? `任务: ${topic}\n\n请从你的专业角度（${agent.name}）开始工作。`
      : `任务: ${topic}\n\n前一个 Agent 的输出:\n${context}\n\n请在此基础上继续。`;

    messages.push({ role: "user", content: prompt });

    yield {
      type: "text",
      content: "",
      agentId: agent.id,
      agentName: agent.name,
      agentColor: agent.color,
      agentAvatar: agent.avatar,
    };

    let fullContent = "";
    try {
      for await (const chunk of streamChatCompletion({ provider, model, messages, stream: true })) {
        if (chunk.type === "text" && chunk.content) {
          fullContent += chunk.content;
          yield {
            type: "text",
            content: chunk.content,
            agentId: agent.id,
            agentName: agent.name,
            agentColor: agent.color,
            agentAvatar: agent.avatar,
          };
        }
      }
    } catch (err) {
      fullContent = `[${agent.name} 失败: ${err instanceof Error ? err.message : String(err)}]`;
    }

    context = fullContent;

    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "assistant" as MessageRole,
      content: fullContent,
      agentId: agent.id,
      agentName: agent.name,
      agentColor: agent.color,
      agentAvatar: agent.avatar,
      createdAt: new Date().toISOString(),
    };
    conversation.messages.push(msg);
  }

  conversation.updatedAt = new Date().toISOString();
  yield { type: "done" };
}

// ─── Hierarchical Mode ──────────────────────────────────────────

export async function* runHierarchical(
  moderator: AgentConfig,
  workers: AgentConfig[],
  topic: string,
  provider: ProviderConfig,
  model: string,
  conversation: Conversation,
  maxRounds: number = 2
): AsyncGenerator<StreamChunk> {
  // 主持分配任务
  const taskAssignments: Map<string, string> = new Map();

  // Round 1: 主持分配
  {
    const prompt = `主题: ${topic}\n\n参与者: ${workers.map((w) => `${w.name}(${w.goal})`).join(", ")}\n\n请为每个参与者分配具体任务。格式:\n[Agent名]: 任务描述`;
    const messages = [
      { role: "system", content: moderator.systemPrompt },
      { role: "user", content: prompt },
    ];

    yield { type: "text", content: "", agentId: moderator.id, agentName: moderator.name, agentColor: moderator.color, agentAvatar: moderator.avatar };

    let fullContent = "";
    try {
      for await (const chunk of streamChatCompletion({ provider, model, messages, stream: true })) {
        if (chunk.type === "text" && chunk.content) {
          fullContent += chunk.content;
          yield { type: "text", content: chunk.content, agentId: moderator.id, agentName: moderator.name, agentColor: moderator.color, agentAvatar: moderator.avatar };
        }
      }
    } catch (err) {
      fullContent = `[主持分配失败: ${err instanceof Error ? err.message : String(err)}]`;
    }

    conversation.messages.push({
      id: `msg-${Date.now()}`,
      role: "assistant" as MessageRole,
      content: fullContent,
      agentId: moderator.id,
      agentName: moderator.name,
      agentColor: moderator.color,
      agentAvatar: moderator.avatar,
      createdAt: new Date().toISOString(),
    });
  }

  // Round 2+: 工人执行
  for (let round = 0; round < maxRounds; round++) {
    for (const worker of workers) {
      const recentMessages = conversation.messages.slice(-10);
      const history = recentMessages.map((m) => `[${m.agentName ?? "用户"}]: ${m.content.slice(0, 200)}`).join("\n");

      const prompt = `主题: ${topic}\n\n讨论历史:\n${history}\n\n请完成你的任务并提交结果。`;
      const messages = [
        { role: "system", content: worker.systemPrompt },
        { role: "user", content: prompt },
      ];

      yield { type: "text", content: "", agentId: worker.id, agentName: worker.name, agentColor: worker.color, agentAvatar: worker.avatar };

      let fullContent = "";
      try {
        for await (const chunk of streamChatCompletion({ provider, model, messages, stream: true })) {
          if (chunk.type === "text" && chunk.content) {
            fullContent += chunk.content;
            yield { type: "text", content: chunk.content, agentId: worker.id, agentName: worker.name, agentColor: worker.color, agentAvatar: worker.avatar };
          }
        }
      } catch (err) {
        fullContent = `[${worker.name} 失败: ${err instanceof Error ? err.message : String(err)}]`;
      }

      conversation.messages.push({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "assistant" as MessageRole,
        content: fullContent,
        agentId: worker.id,
        agentName: worker.name,
        agentColor: worker.color,
        agentAvatar: worker.avatar,
        createdAt: new Date().toISOString(),
        round,
      });
    }
  }

  // 主持总结
  {
    const history = conversation.messages.slice(-20).map((m) => `[${m.agentName}]: ${m.content.slice(0, 300)}`).join("\n");
    const prompt = `主题: ${topic}\n\n所有人的工作成果:\n${history}\n\n请总结最终结论和下一步。`;
    const messages = [
      { role: "system", content: moderator.systemPrompt },
      { role: "user", content: prompt },
    ];

    yield { type: "text", content: "", agentId: moderator.id, agentName: `${moderator.name}·总结`, agentColor: moderator.color, agentAvatar: moderator.avatar };

    let fullContent = "";
    try {
      for await (const chunk of streamChatCompletion({ provider, model, messages, stream: true })) {
        if (chunk.type === "text" && chunk.content) {
          fullContent += chunk.content;
          yield { type: "text", content: chunk.content, agentId: moderator.id, agentName: `${moderator.name}·总结`, agentColor: moderator.color, agentAvatar: moderator.avatar };
        }
      }
    } catch (err) {
      fullContent = `[总结失败: ${err instanceof Error ? err.message : String(err)}]`;
    }

    conversation.messages.push({
      id: `msg-${Date.now()}`,
      role: "assistant" as MessageRole,
      content: fullContent,
      agentId: moderator.id,
      agentName: `${moderator.name}·总结`,
      agentColor: moderator.color,
      agentAvatar: moderator.avatar,
      createdAt: new Date().toISOString(),
    });
  }

  conversation.updatedAt = new Date().toISOString();
  yield { type: "done" };
}

// ─── Roundtable Mode (delegated to roundtable.ts) ───────────────

export { runRoundtableDiscussion } from "./roundtable";

// ─── Single Agent Chat ──────────────────────────────────────────

export async function* streamAgentMessage(
  conversation: Conversation,
  userMessage: string,
  agentId: string,
  provider: ProviderConfig,
  modelId: string,
  installedSkills?: Array<{ nameZh: string; descriptionZh: string; capabilities?: string[] }>,
  specifiedSkill?: string
): AsyncGenerator<StreamChunk> {
  const agent = getAgentById(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const messages: Array<{ role: string; content: string }> = [];

  // Build system prompt with skills awareness
  let systemPrompt = agent.systemPrompt ?? "";

  if (installedSkills && installedSkills.length > 0) {
    const skillsContext = installedSkills.slice(0, 15).map((s) => {
      const caps = s.capabilities ? ` [${s.capabilities.slice(0, 3).join(", ")}]` : "";
      return `- ${s.nameZh}: ${s.descriptionZh.slice(0, 100)}${caps}`;
    }).join("\n");

    if (specifiedSkill) {
      systemPrompt += `\n\n【指定技能】用户要求你使用 "${specifiedSkill}" 技能来完成任务。请优先参考该技能的方法论和最佳实践。`;
    }

    systemPrompt += `\n\n【可用技能】你当前已安装以下技能，在合适的时候可以参考和运用它们的方法论，但不要生搬硬套：\n${skillsContext}\n\n使用原则：\n1. 当任务明显匹配某个技能的使用场景时，自然地运用该技能的方法\n2. 不需要每次都提及技能名称，只需按技能的方法论行事\n3. 如果没有合适的技能，按你自己的专业判断处理\n4. 用户明确指定技能时，优先使用该技能`;
  }

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  for (const msg of conversation.messages.slice(-30)) {
    messages.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.agentName ? `[${msg.agentName}]: ${msg.content}` : msg.content,
    });
  }

  messages.push({ role: "user", content: userMessage });

  yield {
    type: "text",
    content: "",
    agentId: agent.id,
    agentName: agent.name,
    agentColor: agent.color,
    agentAvatar: agent.avatar,
  };

  yield* streamChatCompletion({ provider, model: modelId, messages, stream: true });
}

// ─── Project Generation (legacy) ────────────────────────────────

export async function runProjectGeneration(_input: unknown): Promise<unknown> {
  return { status: "delegated-to-codegen" };
}
