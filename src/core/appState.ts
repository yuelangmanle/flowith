import { createDefaultProviders } from "./modelGateway";
import { runRoundtable, type ProjectGenerationRun } from "./agentOrchestrator";
import type { ApprovalRequest, ProviderConfig } from "./types";

export interface AppState {
  activeView: "workspace" | "settings";
  providers: Array<ProviderConfig & { modelsDiscovered?: number }>;
  currentRun?: Pick<ProjectGenerationRun, "id" | "status" | "clarifyingQuestions" | "logs">;
  approvals: ApprovalRequest[];
  roundtable?: ReturnType<typeof runRoundtable>;
}

export type AppAction =
  | { type: "run-demo" }
  | { type: "approve-next" }
  | { type: "refresh-provider"; providerId: string; modelCount: number }
  | { type: "start-roundtable" };

export function createInitialAppState(): AppState {
  return {
    activeView: "workspace",
    providers: createDefaultProviders(),
    approvals: []
  };
}

export function reduceAppState(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "run-demo": {
      const approvals: ApprovalRequest[] = [
        {
          id: "approval-install",
          type: "install-dependency",
          agent: "开发 Agent",
          reason: "安装项目依赖。",
          command: "npm install",
          risk: "medium",
          status: "pending"
        }
      ];
      return {
        ...state,
        currentRun: {
          id: "run-ai-resume",
          status: "waiting-for-approval",
          clarifyingQuestions: ["目标用户？", "是否登录？", "是否接真实模型？", "是否保存历史？"],
          logs: ["计划已生成，等待审批危险动作。"]
        },
        approvals
      };
    }
    case "approve-next":
      return {
        ...state,
        approvals: state.approvals.map((approval, index) => index === 0 ? { ...approval, status: "approved" } : approval)
      };
    case "refresh-provider":
      return {
        ...state,
        providers: state.providers.map((provider) => provider.id === action.providerId ? { ...provider, modelsDiscovered: action.modelCount } : provider)
      };
    case "start-roundtable":
      return {
        ...state,
        roundtable: runRoundtable({ topic: "如何改进 AI 简历优化工具", rounds: 3, accepted: true })
      };
  }
}

