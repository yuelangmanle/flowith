# Multi-Agent Workspace v0.3.0 变更日志

> 日期: 2026-05-28
> 版本: 0.3.0
> 状态: 已完成

## 新增功能

### 1. UI 全面重构 — 小清新配色
- 从暗色主题切换到明亮小清新风格
- 主色调: 薄荷绿 (#4ECDC4)
- 三栏布局: 侧边栏(240px) + 主内容区 + 右侧面板(300px)
- 支持侧边栏和右面板折叠

### 2. Agent 编排引擎 (S1)
- **顺序模式 (Sequential)**: Agent 按顺序执行，输出作为下一个的输入
- **层级模式 (Hierarchical)**: 主持 Agent 分配任务，工人执行，主持总结
- **圆桌模式 (Roundtable)**: 多 Agent 自由讨论，轮流发言
- 每种模式支持流式输出

### 3. 圆桌 UI (S2)
- QQ 群聊式消息展示
- 投票系统: 创建投票、Agent 投票、关闭投票、查看结果
- 结构化讨论报告生成
- 反方 Agent 集成（大胆提出反对意见）
- 可配置轮数和参与者

### 4. 记忆系统 (S3)
- **L1 对话记忆**: 短期，内存中保留最近 50 条
- **L2 工作记忆**: 任务级，支持标签过滤
- **L3 事实记忆**: 长期持久化，支持确认状态
- **L4 情景记忆**: 长期持久化，记录经验
- 统一记忆查询，包含时间衰减和重要性权重

### 5. 代码生成 (S4)
- 7 阶段流水线: 需求分析 → 技术设计 → 代码生成 → 测试验证 → 修复 → 文档 → 审查
- 自动修复循环（最多 3 次）
- 阶段进度显示
- 支持多种技术栈选择

### 6. 设置页
- 8 个供应商配置（OpenAI、Anthropic、Gemini、DeepSeek、Qwen、Moonshot、Ollama、自定义）
- 连接测试（延迟和模型数量）
- 自动模型发现
- API Key 和 Base URL 可配置

### 7. 自定义 Agent
- 用户可以创建自己的 Agent
- 配置名称、角色、Emoji、System Prompt
- 通过 API 持久化

### 8. 工具调用系统
- 9 种工具定义（读文件、写文件、执行命令等）
- 风险评估（低/中/高）
- 审批系统集成
- 危险命令检测

### 9. 文档研究
- 官方 URL 识别
- 自动文档抓取和摘要
- 集成说明生成

## 技术架构

```
Frontend (React + Vite + TypeScript)
  ↕ HTTP/SSE
Backend (Node.js + TypeScript)
  ↕ HTTP
Cloud AI APIs (OpenAI / Anthropic / DeepSeek / Qwen / Ollama)
```

## 文件结构

```
src/
├── core/
│   ├── types.ts              # 类型定义 (422行)
│   ├── agentConfig.ts        # Agent 配置 (196行)
│   ├── agentOrchestrator.ts  # 编排引擎 (281行)
│   ├── modelGateway.ts       # 模型网关 (562行)
│   ├── roundtable.ts         # 圆桌逻辑 (266行)
│   ├── codeGeneration.ts     # 代码生成 (296行)
│   ├── memoryKnowledge.ts    # 记忆系统 (280行)
│   ├── toolRuntime.ts        # 工具运行时 (180行)
│   ├── workspaceRuntime.ts   # 工作区运行时
│   ├── persistence.ts        # localStorage 持久化
│   ├── appState.ts           # 应用状态管理
│   ├── demoData.ts           # 模板数据
│   ├── docsResearch.ts       # 文档研究
│   └── artifacts.ts          # 工件生成
├── server/
│   ├── index.ts              # API 服务器 (567行)
│   └── workspaceRuntime.node.ts
├── App.tsx                   # 主应用 (959行)
├── styles.css                # 样式 (1057行)
└── main.tsx
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/health | 健康检查 |
| GET/PUT | /api/providers | 供应商管理 |
| POST | /api/providers/test | 测试连接 |
| POST | /api/providers/discover | 发现模型 |
| GET/POST/DELETE | /api/agents | Agent 管理 |
| GET/POST/PUT/DELETE | /api/conversations | 对话管理 |
| POST | /api/chat | 单 Agent 对话 (SSE) |
| POST | /api/roundtable | 圆桌讨论 (SSE) |
| POST | /api/orchestrate/sequential | 顺序编排 (SSE) |
| POST | /api/orchestrate/hierarchical | 层级编排 (SSE) |
| POST | /api/codegen | 代码生成 (SSE) |
| POST | /api/votes | 创建投票 |
| POST | /api/votes/cast | 投票 |
| POST | /api/votes/close | 关闭投票 |
| GET | /api/memory | 记忆状态 |
| POST | /api/memory/query | 查询记忆 |

## 测试

- 10 个测试文件
- 50 个测试用例
- 全部通过

## 后续计划

- S5: 桌面端 (Tauri)
- S6: 移动端 (Capacitor)
- Docker 沙箱执行
- PostgreSQL 数据库
- 向量检索 (pgvector)
