import type {
  AgentConfig,
  ChatMessage,
  Conversation,
  VoteOption,
  VoteSession,
  StructuredReport,
  ReportSection,
  StreamChunk,
  ProviderConfig,
  MessageRole,
} from "./types";
import { getAgentById } from "./agentConfig";
import { streamChatCompletion } from "./modelGateway";

// ─── Roundtable State ───────────────────────────────────────────

export interface RoundtableState {
  conversation: Conversation;
  agents: AgentConfig[];
  currentRound: number;
  maxRounds: number;
  topic: string;
  votes: VoteSession[];
  reports: StructuredReport[];
  status: "idle" | "discussing" | "voting" | "reporting" | "completed";
}

export function createRoundtable(
  topic: string,
  agents: AgentConfig[],
  maxRounds: number = 3
): RoundtableState {
  return {
    conversation: {
      id: `rt-${Date.now()}`,
      title: `圆桌: ${topic}`,
      type: "roundtable",
      agentIds: agents.map((a) => a.id),
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    agents,
    currentRound: 0,
    maxRounds,
    topic,
    votes: [],
    reports: [],
    status: "idle",
  };
}

// ─── Discussion Flow ────────────────────────────────────────────

function buildDiscussionPrompt(
  state: RoundtableState,
  agent: AgentConfig,
  round: number
): string {
  const recentMessages = state.conversation.messages.slice(-20);
  const history = recentMessages
    .map((m) => `[${m.agentName ?? "用户"}]: ${m.content.slice(0, 300)}`)
    .join("\n\n");

  if (round === 0 && recentMessages.length === 0) {
    return `讨论主题：${state.topic}\n\n请从你的专业角度（${agent.name}，${agent.goal}）发表看法。保持简洁，2-3 段。如果有不同意见请直接指出。`;
  }

  return `讨论主题：${state.topic}\n\n已有讨论：\n${history}\n\n现在轮到你（${agent.name}）。请补充、反驳或深化前面的观点。如果你是反方 Agent，请大胆提出反对意见。保持简洁。`;
}

export async function* runRoundtableDiscussion(
  state: RoundtableState,
  provider: ProviderConfig,
  model: string
): AsyncGenerator<StreamChunk> {
  state.status = "discussing";

  for (let round = 0; round < state.maxRounds; round++) {
    state.currentRound = round;

    for (const agent of state.agents) {
      const prompt = buildDiscussionPrompt(state, agent, round);
      const messages: Array<{ role: string; content: string }> = [];

      if (agent.systemPrompt) {
        messages.push({ role: "system", content: agent.systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      yield {
        type: "text",
        content: "",
        agentId: agent.id,
        agentName: agent.name,
        agentColor: agent.color,
        agentAvatar: agent.avatar,
        round,
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
              agentId: agent.id,
              agentName: agent.name,
              agentColor: agent.color,
              agentAvatar: agent.avatar,
              round,
            };
          }
        }
      } catch (err) {
        fullContent = `[${agent.name} 响应失败: ${err instanceof Error ? err.message : String(err)}]`;
        yield { type: "error", error: fullContent, agentId: agent.id };
      }

      const msg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: "assistant" as MessageRole,
        content: fullContent,
        agentId: agent.id,
        agentName: agent.name,
        agentColor: agent.color,
        agentAvatar: agent.avatar,
        createdAt: new Date().toISOString(),
        round,
      };
      state.conversation.messages.push(msg);
    }
  }

  state.status = "completed";
  state.conversation.updatedAt = new Date().toISOString();
  yield { type: "done" };
}

// ─── Voting System ──────────────────────────────────────────────

export function createVoteSession(
  topic: string,
  options: string[],
  conversationId: string
): VoteSession {
  return {
    id: `vote-${Date.now()}`,
    topic,
    options: options.map((label, i) => ({
      id: `opt-${i}`,
      label,
      voterIds: [],
    })),
    status: "active",
    createdAt: new Date().toISOString(),
    conversationId,
  };
}

export function castVote(
  session: VoteSession,
  optionId: string,
  agentId: string
): VoteSession {
  if (session.status !== "active") return session;

  const updatedOptions = session.options.map((opt) => {
    const votersWithout = opt.voterIds.filter((id) => id !== agentId);
    if (opt.id === optionId) {
      return { ...opt, voterIds: [...votersWithout, agentId] };
    }
    return { ...opt, voterIds: votersWithout };
  });

  return { ...session, options: updatedOptions };
}

export function closeVote(session: VoteSession): VoteSession {
  if (session.status !== "active") return session;

  let maxVotes = 0;
  let winnerId = "";
  for (const opt of session.options) {
    if (opt.voterIds.length > maxVotes) {
      maxVotes = opt.voterIds.length;
      winnerId = opt.id;
    }
  }

  return {
    ...session,
    status: "closed",
    closedAt: new Date().toISOString(),
    winnerId,
  };
}

export function getVoteResults(session: VoteSession): {
  totalVotes: number;
  winner: VoteOption | null;
  results: Array<{ option: VoteOption; percentage: number }>;
} {
  const totalVotes = session.options.reduce((sum, opt) => sum + opt.voterIds.length, 0);
  const winner = session.options.reduce((w, opt) =>
    opt.voterIds.length > (w?.voterIds.length ?? 0) ? opt : w
  , null as VoteOption | null);

  return {
    totalVotes,
    winner: session.status === "closed" ? winner : null,
    results: session.options.map((opt) => ({
      option: opt,
      percentage: totalVotes > 0 ? Math.round((opt.voterIds.length / totalVotes) * 100) : 0,
    })),
  };
}

// ─── Structured Report ──────────────────────────────────────────

export function generateReport(state: RoundtableState): StructuredReport {
  const agentSections: ReportSection[] = state.agents.map((agent) => {
    const agentMessages = state.conversation.messages.filter((m) => m.agentId === agent.id);
    const summary = agentMessages.map((m) => m.content.slice(0, 200)).join("\n---\n");
    return {
      title: `${agent.avatar} ${agent.name} 观点`,
      content: summary || "未发言",
      agentId: agent.id,
    };
  });

  const voteSections = state.votes
    .filter((v) => v.status === "closed")
    .map((v) => {
      const results = getVoteResults(v);
      return {
        title: `投票: ${v.topic}`,
        content: `结果: ${results.winner?.label ?? "无结果"} (${results.totalVotes} 票)`,
      };
    });

  const allMessages = state.conversation.messages;
  const lastMessages = allMessages.slice(-3).map((m) => m.content.slice(0, 100));
  const conclusion = lastMessages.length > 0
    ? `讨论共 ${state.currentRound + 1} 轮，${allMessages.length} 条发言。最后发言摘要：${lastMessages.join(" | ")}`
    : "尚未完成讨论";

  return {
    id: `report-${Date.now()}`,
    title: `圆桌讨论报告: ${state.topic}`,
    topic: state.topic,
    sections: [...agentSections, ...voteSections],
    conclusion,
    agentIds: state.agents.map((a) => a.id),
    conversationId: state.conversation.id,
    createdAt: new Date().toISOString(),
  };
}
