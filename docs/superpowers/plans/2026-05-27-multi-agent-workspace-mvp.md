# Multi-Agent Workspace MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 构建一个本地可运行的多 Agent 工作平台 MVP，覆盖项目原型生成、圆桌讨论、模型供应商配置/自动发现、官方文档研究、记忆/RAG 原型、工具审批和工作区预览闭环。

**Architecture:** 使用 Vite + React + TypeScript 构建工作台 UI，同时提供 Node 本地 API 服务执行真实 workspace 目录创建、文件写入、受控命令执行和预览启动。业务逻辑集中在 `src/core/*`，Node 侧运行时集中在 `src/server/*`，测试使用 Vitest 覆盖核心流程和真实落盘 runtime。Agent 输出先使用确定性本地实现，模型网关保留真实 Provider API 自动发现接口。

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Node.js fs/child_process/http, localStorage, browser fetch API.

---

## File Structure

- `package.json`: npm 脚本、依赖和项目元数据。
- `vite.config.ts`: Vite/Vitest 配置。
- `tsconfig.json`, `tsconfig.node.json`: TypeScript 配置。
- `index.html`: 应用入口。
- `src/main.tsx`: React 挂载入口。
- `src/App.tsx`: Workspace-first 主界面和用户交互。
- `src/styles.css`: 页面布局、工作台、日志、卡片、审批等样式。
- `src/core/types.ts`: 核心实体类型。
- `src/core/modelGateway.ts`: Provider 配置、模型自动发现、能力标记。
- `src/core/workspaceRuntime.ts`: workspace/project 文件、命令审批和预览状态模拟。
- `src/core/agentOrchestrator.ts`: 生成项目流程和圆桌讨论流程。
- `src/core/memoryKnowledge.ts`: 分层记忆、知识库、简单检索。
- `src/core/docsResearch.ts`: 官方文档研究工具和 Integration Note 生成。
- `src/core/artifacts.ts`: README、架构说明、任务报告生成。
- `src/core/demoData.ts`: 默认供应商、Agent、模板和示例。
- `src/server/workspaceRuntime.node.ts`: 真实本地 workspace、文件写入、受控命令、预览进程。
- `src/server/index.ts`: 本地 API 服务，供 UI 触发真实 demo flow。
- `src/core/__tests__/*.test.ts`: TDD 核心测试。
- `src/server/__tests__/*.test.ts`: Node runtime 测试。
- `docs/progress/implementation-log.md`: 按阶段记录实现进度、验证结果和接手说明。
- `docs/handoff.md`: 最终交接文档。

## Task 1: Project Scaffold And Progress Log

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `docs/progress/implementation-log.md`

- [x] **Step 1: Write the initial smoke test**
  Create `src/core/__tests__/smoke.test.ts` asserting the test runner works and imports a future app metadata export.

- [x] **Step 2: Run test to verify it fails**
  Run: `npm test -- --run src/core/__tests__/smoke.test.ts`
  Expected: FAIL because dependencies/code do not exist yet.

- [x] **Step 3: Add scaffold and minimal app metadata**
  Add npm/Vite/TypeScript files, local API scripts, minimal React app, and `src/core/demoData.ts` exporting app metadata.

- [x] **Step 4: Install dependencies**
  Run: `npm install`
  Expected: dependencies install successfully.

- [x] **Step 5: Run test to verify it passes**
  Run: `npm test -- --run src/core/__tests__/smoke.test.ts`
  Expected: PASS.

- [x] **Step 6: Update progress log**
  Record scaffold files, install result, and next handoff point.

## Task 2: Core Domain Types And Model Gateway

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/modelGateway.ts`
- Create: `src/core/__tests__/modelGateway.test.ts`
- Modify: `docs/progress/implementation-log.md`

- [x] **Step 1: Write failing tests**
  Tests cover OpenAI-compatible `/v1/models` parsing, Ollama `/api/tags` parsing, provider records for OpenAI/Anthropic/Gemini/DeepSeek/Qwen/Moonshot/Ollama/custom endpoints, fallback candidate models, stale models preserved after refresh failure, and capability metadata for chat/completion/embedding/vision/tool calling/JSON/reasoning/local/fast/cheap/large context.

- [x] **Step 2: Run red tests**
  Run: `npm test -- --run src/core/__tests__/modelGateway.test.ts`
  Expected: FAIL because implementation is missing.

- [x] **Step 3: Implement types and model gateway**
  Add provider/model types and model discovery functions with injectable fetch for tests.

- [x] **Step 4: Run green tests**
  Run: `npm test -- --run src/core/__tests__/modelGateway.test.ts`
  Expected: PASS.

- [x] **Step 5: Update progress log**
  Record supported providers, discovery behavior, and known limitations.

## Task 3: Memory, Knowledge, Docs Research, And Artifacts

**Files:**
- Create: `src/core/memoryKnowledge.ts`
- Create: `src/core/docsResearch.ts`
- Create: `src/core/artifacts.ts`
- Create: `src/core/__tests__/knowledge.test.ts`
- Modify: `docs/progress/implementation-log.md`

- [x] **Step 1: Write failing tests**
  Tests cover long-term memory write policy, source traceability, confirmation state, retention/deletion flags, accepted roundtable conclusion persistence, memory/knowledge separation, metadata filters, hybrid keyword/vector-like retrieval, official docs source validation, non-official approval requirement, and complete Integration Note fields.

- [x] **Step 2: Run red tests**
  Run: `npm test -- --run src/core/__tests__/knowledge.test.ts`
  Expected: FAIL because modules are missing.

- [x] **Step 3: Implement memory/knowledge/docs/artifacts**
  Keep implementation deterministic and local-first. Use simple token scoring for semantic-like retrieval in MVP.

- [x] **Step 4: Run green tests**
  Run: `npm test -- --run src/core/__tests__/knowledge.test.ts`
  Expected: PASS.

- [x] **Step 5: Update progress log**
  Record what is real, what is mocked, and how to replace with sqlite-vec/LanceDB later.

## Task 4: Workspace Runtime And Tool Approval

**Files:**
- Create: `src/core/workspaceRuntime.ts`
- Create: `src/core/__tests__/workspaceRuntime.test.ts`
- Modify: `docs/progress/implementation-log.md`

- [x] **Step 1: Write failing tests**
  Tests cover real workspace directory creation, file writes allowed inside workspace, dangerous actions producing approval requests, command working directory restriction, timeout, stdout/stderr capture, long-output compression, retry limit metadata, dangerous-command detection, preview state, full tool-call logging, and blocking outside-workspace paths.

- [x] **Step 2: Run red tests**
  Run: `npm test -- --run src/core/__tests__/workspaceRuntime.test.ts`
  Expected: FAIL because module is missing.

- [x] **Step 3: Implement workspace runtime**
  Implement a shared policy layer plus Node runtime that writes real files under `.agent-workspaces/`, executes approved commands with guardrails, and starts local preview commands. Browser state may mirror the same data but must not be the only runtime.

- [x] **Step 4: Run green tests**
  Run: `npm test -- --run src/core/__tests__/workspaceRuntime.test.ts`
  Expected: PASS.

- [x] **Step 5: Update progress log**
  Record approval policy and runtime boundaries.

## Task 5: Agent Orchestrator Flows

**Files:**
- Create: `src/core/agentOrchestrator.ts`
- Create: `src/core/__tests__/agentOrchestrator.test.ts`
- Modify: `docs/progress/implementation-log.md`

- [x] **Step 1: Write failing tests**
  Tests cover the full demo path: AI resume app idea, 3-5 clarification questions, user tech stack override, official-supported/experimental marker, plan confirmation before writes, product/architecture/development/testing/docs/review agents, approval checkpoints for install/run, real project files, preview command, simulated fix loop, README/architecture/next steps, memory writes, docs research source, and roundtable summary conversion.

- [x] **Step 2: Run red tests**
  Run: `npm test -- --run src/core/__tests__/agentOrchestrator.test.ts`
  Expected: FAIL because orchestrator is missing.

- [x] **Step 3: Implement orchestrator**
  Generate deterministic demo project files and logs through the workspace runtime. Include one simulated fix loop and final artifacts.

- [x] **Step 4: Run green tests**
  Run: `npm test -- --run src/core/__tests__/agentOrchestrator.test.ts`
  Expected: PASS.

- [x] **Step 5: Update progress log**
  Record flow steps, agents, artifacts, and handoff notes.

## Task 5B: Local API Server

**Files:**
- Create: `src/server/index.ts`
- Create: `src/server/workspaceRuntime.node.ts`
- Create: `src/server/__tests__/nodeRuntime.test.ts`
- Modify: `docs/progress/implementation-log.md`

- [x] **Step 1: Write failing tests**
  Tests call the Node runtime directly to create a demo project directory, write files, run a safe command, reject a dangerous command, and return a preview URL/port state.

- [x] **Step 2: Run red tests**
  Run: `npm test -- --run src/server/__tests__/nodeRuntime.test.ts`
  Expected: FAIL because server runtime is missing.

- [x] **Step 3: Implement Node runtime and API**
  Use Node `fs`, `path`, `child_process`, and `http`. Expose `/api/demo/run`, `/api/providers/discover`, `/api/approvals`, and `/api/workspaces/:id`.

- [x] **Step 4: Run green tests**
  Run: `npm test -- --run src/server/__tests__/nodeRuntime.test.ts`
  Expected: PASS.

- [x] **Step 5: Update progress log**
  Record API endpoints and workspace root.

## Task 6: Workspace UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/core/__tests__/appState.test.ts`
- Modify: `docs/progress/implementation-log.md`

- [x] **Step 1: Write failing state tests**
  Tests cover initial app state, running the demo generation flow, adding provider models, approving queued action, and starting roundtable.

- [x] **Step 2: Run red tests**
  Run: `npm test -- --run src/core/__tests__/appState.test.ts`
  Expected: FAIL because app state helpers are missing.

- [x] **Step 3: Implement app state helpers and UI**
  Build Workspace-first UI with left project/task nav, center agent console, right files/logs/preview/artifacts, top status, and settings panels.

- [x] **Step 4: Run green tests**
  Run: `npm test -- --run src/core/__tests__/appState.test.ts`
  Expected: PASS.

- [x] **Step 5: Update progress log**
  Record UI behavior and demo steps.

## Task 7: Full Verification And Handoff

**Files:**
- Create: `docs/handoff.md`
- Modify: `docs/progress/implementation-log.md`

- [x] **Step 1: Run full unit test suite**
  Run: `npm test -- --run`
  Expected: PASS.

- [x] **Step 2: Run typecheck**
  Run: `npm run typecheck`
  Expected: PASS.

- [x] **Step 3: Run production build**
  Run: `npm run build`
  Expected: PASS.

- [x] **Step 4: Start dev server and inspect app**
  Run: `npm run dev -- --host 127.0.0.1`
  Expected: local URL serves the app.

- [x] **Step 5: Write handoff**
  Include architecture summary, commands, implemented scope, gaps, and next tasks.

- [x] **Step 6: Commit**
  Commit implementation with a clear message after verification because the user requested uninterrupted end-to-end completion and has allowed autonomous execution.
