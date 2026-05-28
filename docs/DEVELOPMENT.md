# 开发指南 — Multi-Agent Workspace

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（前端 + 后端）
npm run dev

# 前端: http://127.0.0.1:5173/
# 后端: http://127.0.0.1:8787/
```

## 项目架构

### 前端 (React + Vite)
- `src/App.tsx` — 主应用组件，包含所有视图
- `src/styles.css` — 小清新主题样式
- `src/core/` — 核心业务逻辑（与 UI 解耦）

### 后端 (Node.js)
- `src/server/index.ts` — HTTP API 服务器
- 所有 AI 调用通过后端代理，前端不直接调用 AI API

### 核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| 类型系统 | `core/types.ts` | 所有 TypeScript 类型定义 |
| 模型网关 | `core/modelGateway.ts` | 多供应商模型调用、流式输出、模型发现 |
| Agent 配置 | `core/agentConfig.ts` | 11 个默认 Agent + 自定义 Agent |
| 编排引擎 | `core/agentOrchestrator.ts` | 顺序/层级/圆桌三种模式 |
| 圆桌系统 | `core/roundtable.ts` | 讨论、投票、报告生成 |
| 代码生成 | `core/codeGeneration.ts` | 7 阶段流水线 + 修复循环 |
| 记忆系统 | `core/memoryKnowledge.ts` | L1-L4 分层记忆 + 知识库 |
| 工具运行时 | `core/toolRuntime.ts` | 工具定义、风险评估、审批 |
| 文档研究 | `core/docsResearch.ts` | 官方文档抓取和分析 |
| 持久化 | `core/persistence.ts` | localStorage 客户端持久化 |

## 数据流

```
用户输入 → App.tsx → API 调用 → server/index.ts
  → modelGateway → 供应商 API → 流式响应 → SSE → 前端渲染
```

## 添加新供应商

1. 在 `core/modelGateway.ts` 的 `providerDefaults` 中添加
2. 在 `core/types.ts` 的 `ProviderType` 中添加类型
3. 在 `discoverModels()` 中添加发现逻辑
4. 在 `callChatCompletion()` 和 `streamChatCompletion()` 中添加调用逻辑

## 添加新 Agent

1. 在 `core/agentConfig.ts` 的 `DEFAULT_AGENTS` 中添加
2. 设置 `role`、`systemPrompt`、`tools`、`color`
3. 在 `getAgentsForRoundtable()` 和 `getAgentsForProjectGeneration()` 中按需添加

## 添加新工具

1. 在 `core/toolRuntime.ts` 的 `TOOL_DEFINITIONS` 中添加
2. 在 `assessRisk()` 中添加风险评估逻辑
3. 在 `server/index.ts` 中添加执行逻辑

## 测试

```bash
# 运行所有测试
npx vitest run

# 监听模式
npx vitest

# 类型检查
npx tsc -b

# 构建
npm run build
```

## 部署

```bash
# 构建生产版本
npm run build

# 产物在 dist/ 目录
# 后端需要单独运行: node dist/server/index.js
```

## 注意事项

- AI API 调用全部通过后端代理，避免 CORS 和密钥泄露
- 流式响应用 SSE (Server-Sent Events)
- 客户端数据用 localStorage 持久化，后端用 JSON 文件
- 所有工具调用需要经过风险评估，高风险操作需要用户审批
