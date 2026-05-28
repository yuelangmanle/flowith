# 多 Agent 工作平台 - 竞品调研与多端方案报告

> 调研日期：2026-05-27
> 调研对象：crewAI、ChatDev、Dify、agent-workspace
> 目标：分析对本项目的参考价值，规划 Mac/Win/Android 多端支持

---

## 一、竞品分析

### 1. CrewAI（github.com/crewAIInc/crewAI）

**定位：** 多 Agent 协作编排框架（Python）

**核心架构：**
- `Agent`：定义角色、目标、backstory、可用工具
- `Task`：具体任务描述、期望输出、关联 Agent
- `Crew`：一组 Agent + Task 的编排，支持 sequential/hierarchical 流程
- `Flow`：更高层的工作流编排，支持条件分支和循环

**对我们的参考价值：⭐⭐⭐⭐⭐**

| 方面 | CrewAI 做法 | 我们可以借鉴 |
|------|------------|-------------|
| Agent 定义 | 角色 + 目标 + backstory + 工具列表 | 我们已有 systemPrompt + tools，可以增加 goal 和 backstory 字段 |
| 任务编排 | sequential（顺序）/ hierarchical（层级）两种模式 | 我们的圆桌是 round-robin，可以增加 hierarchical 模式 |
| 工具系统 | Tool 是 Python 函数，Agent 通过 LLM 决定何时调用 | 我们的工具是静态列表，应改为 function calling 动态调用 |
| 记忆系统 | 短期记忆（对话）+ 长期记忆（跨 Crew） | 我们已有 memory 模块，但没有让 Agent 主动读写记忆 |
| 流程控制 | crew.kickoff() 启动，支持异步和回调 | 我们的 group-chat 是同步的，应支持异步和进度回调 |

**我们应该做的：**
1. 借鉴 goal 和 backstory 字段丰富 Agent 定义
2. 实现 sequential 和 hierarchical 两种任务编排模式
3. 让 Agent 通过 function calling 动态调用工具

---

### 2. ChatDev（github.com/openbmb/ChatDev）

**定位：** 虚拟 AI 软件公司（Python）

**核心架构：**
- 虚拟公司结构：CEO、CTO、程序员、测试员、设计师等角色
- 阶段式开发流程：设计 → 编码 → 测试 → 文档
- 每个阶段由特定角色的 Agent 负责
- Agent 之间通过自然语言对话协作
- 支持 Chain of Thought 和反思机制

**对我们的参考价值：⭐⭐⭐⭐**

| 方面 | ChatDev 做法 | 我们可以借鉴 |
|------|------------|-------------|
| 角色分工 | 7 个固定角色，每个有明确职责 | 我们有 11 个 Agent，但职责边界不够清晰 |
| 阶段式流程 | 需求分析 → 系统设计 → 编码 → 测试 → 文档 | 我们的项目生成是扁平的，应改为阶段式 |
| 对话协议 | Agent 之间通过结构化对话协作 | 我们的圆桌是自由讨论，可增加结构化协议 |
| 反思机制 | Agent 完成任务后会自我审查 | 我们的评审 Agent 只在最后审查，应让每个 Agent 都反思 |
| 源码生成 | 真实生成可运行的项目代码 | 我们的项目生成是模板化的，应接入真实 LLM |

**我们应该做的：**
1. 实现阶段式项目生成流程
2. 增加 Agent 自我反思机制
3. 增加结构化对话协议

---

### 3. Dify（github.com/langgenius/dify）

**定位：** LLM 应用开发平台（Python + TypeScript）

**核心架构：**
- 可视化工作流编排（拖拽式）
- 多模型接入（OpenAI、Anthropic、本地模型等）
- 知识库管理（RAG）
- 应用发布和 API 对话
- 团队协作

**对我们的参考价值：⭐⭐⭐⭐⭐**

| 方面 | Dify 做法 | 我们可以借鉴 |
|------|----------|-------------|
| 模型管理 | 统一配置页面，连接测试和模型发现 | 我们已有类似功能，可参考 UI 设计 |
| 工作流 | 可视化拖拽编排，条件分支、循环、并行 | 长期应做可视化编排 |
| 知识库 | 上传文档 → 分块 → 向量化 → 检索 | 我们的 RAG 是关键词匹配，应升级为向量检索 |
| API 服务 | 每个应用都有 REST API | 我们的 API 是内部的，应对外开放 |
| 团队协作 | 多人可同时编辑和使用 | 我们是单用户，长期应支持团队 |

**我们应该做的：**
1. 参考 Dify 的模型管理 UI
2. 长期规划可视化工作流编排
3. 升级 RAG 为向量检索
4. 对外暴露 REST API

---

### 4. agent-workspace（github.com/pandu1992/agent-workspace）

**定位：** AI Agent 工作空间隔离工具

**核心架构：**
- Git worktree 隔离：每个任务在独立 git worktree 中执行
- 终端会话管理：每个工作空间有独立终端
- 文件系统隔离：Agent 只能操作工作空间内文件
- 命令审批：危险命令需要用户确认

**对我们的参考价值：⭐⭐⭐**

| 方面 | agent-workspace 做法 | 我们可以借鉴 |
|------|-------------------|-------------|
| 工作空间隔离 | Git worktree 物理隔离 | 我们用目录隔离，可升级为 git worktree |
| 终端管理 | 每个工作空间有独立终端会话 | 我们没有终端 UI，应该添加 |
| 命令审批 | 危险命令需确认 | 我们已有 approval 系统，但 UI 不完善 |
| 文件浏览 | 实时文件树 + diff 视图 | 我们的文件浏览是静态的，应实时刷新 |

**我们应该做的：**
1. 实现 git worktree 隔离
2. 添加终端 UI（集成 xterm.js）
3. 完善审批队列 UI
4. 添加 diff 视图

---

## 二、综合对比

| 特性 | CrewAI | ChatDev | Dify | agent-workspace | 我们 |
|------|--------|---------|------|----------------|------|
| 多 Agent 编排 | 优秀 | 优秀 | 基础 | 无 | 基础 |
| 模型接入 | 多模型 | OpenAI为主 | 多模型 | 无 | 多模型 |
| 可视化工作流 | 无 | 无 | 拖拽式 | 无 | 无 |
| 知识库/RAG | 有 | 无 | 优秀 | 无 | 基础 |
| 工作空间隔离 | 无 | 无 | 无 | 优秀 | 基础 |
| UI 界面 | CLI | CLI | Web | 基础 | Web |
| 团队协作 | 无 | 无 | 有 | 无 | 无 |
| 多端支持 | 无 | 无 | Web | 无 | 无 |

**我们的差异化优势：**
1. Workspace-first UI：Dify 是 workflow-first，我们是 workspace-first，更适合开发者
2. 多 Agent 实时对话：支持流式输出的圆桌讨论
3. 本地优先：不需要云端部署，开箱即用
4. 中文优先：Agent 人设和 UI 都是中文

**我们的差距：**
1. Agent 编排不如 CrewAI 灵活
2. 阶段式流程不如 ChatDev 清晰
3. RAG 不如 Dify 强大
4. 工作空间隔离不如 agent-workspace 完善

---

## 三、多端支持方案

### 当前架构

```
前端: React + Vite (Web)
后端: Node.js HTTP Server
数据: localStorage + JSON 文件
```

### 多端技术方案对比

| 方案 | Mac | Win | Android | 开发成本 | 性能 | 原生体验 |
|------|-----|-----|---------|---------|------|---------|
| Electron | Yes | Yes | No | 低 | 中 | 差 |
| Tauri | Yes | Yes | No | 低 | 优 | 良 |
| Flutter | Yes | Yes | Yes | 高 | 优 | 优 |
| React Native | Yes | Yes | Yes | 高 | 良 | 良 |
| PWA | Yes | Yes | Yes | 低 | 中 | 差 |
| Capacitor | Yes | Yes | Yes | 中 | 中 | 中 |

### 推荐方案：Tauri（桌面）+ Capacitor（移动端）

**Tauri（桌面端 - Mac/Win/Linux）：**
- 基于 Rust，性能优秀，包体积极小（约 5MB vs Electron 约 150MB）
- 前端复用现有 React 代码
- 后端可用 Rust 或保留 Node.js 子进程
- 安全性高（Rust 内存安全）

**Capacitor（移动端 - Android/iOS）：**
- 由 Ionic 团队维护，稳定性好
- 直接包装现有 Web 应用
- 支持调用原生 API（相机、文件系统、推送等）
- 前端复用现有 React 代码

**为什么不选其他方案：**
- Electron：包体积太大，性能差，不支持移动端
- Flutter：需要重写前端，学习成本高
- React Native：需要重写 UI 组件，与现有代码不兼容
- PWA：功能受限，无法访问文件系统和终端

### 实施路线图

**阶段 1: 桌面端 (Tauri) - 2-3 周**
1. 安装 Tauri CLI
2. 配置 tauri.conf.json
3. 将 Vite 前端集成到 Tauri
4. 将 Node.js 后端改为 Tauri Rust 后端或保留 Node.js 子进程
5. 实现系统托盘、通知
6. 打包 .dmg (Mac) 和 .msi (Win)

**阶段 2: 移动端 (Capacitor) - 2-3 周**
1. 安装 Capacitor
2. 配置 Android 项目
3. 适配移动端 UI（响应式布局）
4. 实现推送通知
5. 打包 .apk (Android)

**阶段 3: 功能适配 - 持续**
1. 桌面端：系统托盘常驻、全局快捷键、文件拖拽
2. 移动端：离线模式、推送通知、手势操作
3. 通用：云同步、多设备对话同步

### 代码结构建议

```
project/
├── src/                    # 共享代码（React + Core）
│   ├── App.tsx
│   ├── core/               # 业务逻辑（跨平台共享）
│   └── components/         # UI 组件（跨平台共享）
├── src-tauri/              # Tauri 桌面端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/main.rs
├── android/                # Capacitor Android
│   └── app/
├── capacitor.config.ts     # Capacitor 配置
└── package.json
```

---

## 四、行动建议

### 短期（1-2 周）- 借鉴 CrewAI 和 ChatDev

1. 丰富 Agent 定义：增加 goal、backstory 字段
2. 实现阶段式项目生成：需求分析 → 设计 → 编码 → 测试
3. 增加 Agent 反思机制
4. 完善审批队列 UI

### 中期（1-2 月）- 借鉴 Dify

1. 升级 RAG 为向量检索（sqlite-vec 或 LanceDB）
2. 对外暴露 REST API
3. 可视化工作流编排（拖拽式）
4. 知识库管理 UI

### 长期（3-6 月）- 多端支持

1. 桌面端：Tauri 打包 Mac/Win
2. 移动端：Capacitor 打包 Android
3. 云同步：多设备对话和项目同步
4. 团队协作：多人同时使用

---

## 五、结论

**这四个项目对我们都很有参考价值：**

- **CrewAI**：Agent 编排和工具系统设计 → 提升 Agent 协作能力
- **ChatDev**：阶段式开发流程和角色分工 → 项目生成更真实
- **Dify**：模型管理、RAG、可视化工作流 → 长期产品方向
- **agent-workspace**：工作空间隔离和终端管理 → 完善开发者体验

**多端支持推荐 Tauri + Capacitor：**
- 一套 React 代码，覆盖 Mac/Win/Android/iOS
- 桌面端用 Tauri（性能好、包体积小）
- 移动端用 Capacitor（开发成本低、原生 API 支持好）
- 核心业务逻辑完全共享，只需适配 UI 和平台 API
