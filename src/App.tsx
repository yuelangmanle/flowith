import { useMemo, useState } from "react";
import { Activity, Bot, CheckCircle2, Files, GitBranch, Play, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { createInitialAppState, reduceAppState } from "./core/appState";
import { appMetadata, defaultAgents, defaultIdea, officialStacks } from "./core/demoData";
import { createDefaultProviders } from "./core/modelGateway";
import { runProjectGeneration, runRoundtable, type ProjectGenerationRun } from "./core/agentOrchestrator";

type DemoStatus = "idle" | "running" | "done" | "error";

export function App() {
  const [state, setState] = useState(createInitialAppState);
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [run, setRun] = useState<ProjectGenerationRun | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string>("");
  const [error, setError] = useState("");
  const providers = useMemo(() => createDefaultProviders(), []);

  async function runDemo() {
    setStatus("running");
    setError("");
    setState((current) => reduceAppState(current, { type: "run-demo" }));
    try {
      const response = await fetch("http://127.0.0.1:8787/api/demo/run", { method: "POST" });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const body = await response.json() as { run: ProjectGenerationRun; workspace: { path: string } };
      setRun(body.run);
      setWorkspacePath(body.workspace.path);
      setState((current) => reduceAppState(current, { type: "approve-next" }));
      setStatus("done");
    } catch (apiError) {
      const fallback = await runProjectGeneration({
        idea: defaultIdea,
        stackOverride: "Vite + React + TypeScript",
        confirmPlan: true,
        approveDangerousActions: true
      });
      setRun(fallback);
      setWorkspacePath("API 未启动，当前展示浏览器内确定性演示。运行 npm run dev 可启用真实本地 workspace。");
      setError(apiError instanceof Error ? apiError.message : String(apiError));
      setStatus("error");
    }
  }

  function startRoundtable() {
    const roundtable = runRoundtable({ topic: "如何改进 AI 简历优化工具", rounds: 3, accepted: true });
    setState((current) => ({ ...reduceAppState(current, { type: "start-roundtable" }), roundtable }));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Workspace-first</p>
          <h1>{appMetadata.name}</h1>
        </div>
        <div className="status-strip">
          <span><Bot size={16} /> 8 Agents</span>
          <span><ShieldCheck size={16} /> 危险动作确认</span>
          <span><GitBranch size={16} /> Worktree Ready</span>
          <span><Activity size={16} /> {status}</span>
        </div>
      </header>

      <section className="workspace-grid">
        <aside className="panel sidebar">
          <h2>项目与模板</h2>
          <button className="primary" onClick={runDemo} disabled={status === "running"}>
            {status === "running" ? <RefreshCw size={16} /> : <Play size={16} />} 生成项目原型
          </button>
          <button onClick={startRoundtable}>多 Agent 圆桌</button>
          <button>写文档 / 知识整理</button>
          <div className="stack-list">
            <h3>官方支持技术栈</h3>
            {officialStacks.map((stack) => (
              <article key={stack.id}>
                <strong>{stack.name}</strong>
                <span>{stack.description}</span>
              </article>
            ))}
          </div>
        </aside>

        <section className="panel console">
          <div className="panel-heading">
            <h2>Agent 控制台</h2>
            <span>{run?.status ?? state.currentRun?.status ?? "project-generation"}</span>
          </div>
          <div className="prompt-box">{defaultIdea}</div>
          {error ? <div className="notice">本地 API 暂不可用：{error}。已降级展示确定性流程。</div> : null}
          {workspacePath ? <div className="notice success"><CheckCircle2 size={16} /> 工作区：{workspacePath}</div> : null}
          <ol className="timeline">
            {(run?.logs ?? [
              "产品 Agent 将提出 4 个澄清问题",
              "架构 Agent 将推荐 Vite + React + TypeScript",
              "主持 Agent 等待计划确认",
              "开发 Agent 准备写入项目文件",
              "测试 Agent 请求运行 npm install 和 dev server"
            ]).map((item, index) => (
              <li key={item}>
                <span>{index + 1}</span>
                {item}
              </li>
            ))}
          </ol>
          <div className="agent-row">
            {defaultAgents.map((agent) => <span key={agent}>{agent}</span>)}
          </div>
          {state.roundtable ? (
            <section className="roundtable">
              <h3>圆桌结论</h3>
              <p>{state.roundtable.summary}</p>
            </section>
          ) : null}
        </section>

        <aside className="panel inspector">
          <div className="panel-heading">
            <h2>工作区</h2>
            <span>local preview</span>
          </div>
          <div className="tabs">
            <button><Files size={15} /> 文件</button>
            <button><Activity size={15} /> 日志</button>
            <button><Settings size={15} /> 设置</button>
          </div>
          <pre className="file-tree">{run ? Object.keys(run.files).map((file) => `├─ ${file}`).join("\n") : `ai-resume-optimizer/
├─ package.json
├─ src/App.tsx
├─ src/main.tsx
├─ README.md
└─ docs/architecture.md`}</pre>
          <div className="preview-box">
            <strong>预览状态</strong>
            <span>{run ? `${run.preview.status}: ${run.preview.url}` : "等待审批后启动 dev server"}</span>
          </div>
          <div className="provider-box">
            <h3>模型供应商</h3>
            {providers.map((provider) => (
              <span key={provider.id}>{provider.name}</span>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
