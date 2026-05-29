<p align="center">
  <img src="public/icon.svg" width="100" alt="Flowith Logo">
</p>

<h1 align="center">Flowith</h1>

<p align="center">
  <strong>多 AI Agent 协作工作平台</strong>
</p>

<p align="center">
  多种模型 · 圆桌讨论 · 代码生成 · 技能管理 · Token 优化 · 安卓支持
</p>

<p align="center">
  <a href="https://yuelangmanle.github.io/flowith/">🌐 精美下载页</a> ·
  <a href="https://github.com/yuelangmanle/flowith/releases">📦 下载安装包</a> ·
  <a href="https://github.com/yuelangmanle/flowith/issues">🐛 反馈问题</a>
</p>

---

## ✨ 功能特性

### 🤖 多 Agent 协作
- **顺序编排** — Agent 按序执行，前者输出作为后者输入
- **层级编排** — 主持人分配任务，工人执行，最后总结
- **圆桌讨论** — 多个 AI 辩论投票，生成结构化报告，支持反方角色

### 🚀 多模型支持
| 供应商 | 模型 | 特点 |
|--------|------|------|
| OpenAI | GPT-4o, o3, o4-mini | 全球领先 |
| Anthropic | Claude Sonnet/Opus 4 | 深度思考 |
| DeepSeek | deepseek-chat, reasoner | 性价比极高 |
| 小米 MiMo | MiMo-GPT | 联网搜索 |
| 通义千问 | qwen-max/plus/turbo | 中文能力强 |
| Moonshot | Kimi | 长上下文 |
| Ollama | 本地开源模型 | 完全免费 |
| 兼容接口 | 任意 OpenAI API | 自定义扩展 |

### 🛠 技能系统
- 安装管理 AI 技能插件，Agent 自动学习运用
- GitHub 搜索安装，支持联网搜索和本地文件导入
- 用户可指定 Agent 使用特定技能

### 💻 代码生成
- 从想法到可运行代码的 AI 驱动全流程
- 工作空间隔离，多轮修复，代码预览

### 📦 Token 优化
- 智能上下文压缩（L1-L4 四层压缩引擎）
- Anthropic prompt caching 缓存命中
- 动态 max_tokens 管理
- 前端实时显示 token 消耗

### 🧠 深度思考
- Claude、DeepSeek、Gemini 深度思考模式
- 思考过程可折叠展示，透明可控

---

## 📥 安装

### 桌面应用（推荐）

前往 **[精美下载页](https://yuelangmanle.github.io/flowith/)** 下载，或直接点击：

| 平台 | 下载 |
| Android | [即将推出](https://github.com/yuelangmanle/flowith/releases) |
|------|------|
| macOS (Apple Silicon) | [Flowith_1.0.0_aarch64.dmg](https://github.com/yuelangmanle/flowith/releases/download/v1.0.0/Flowith_1.0.0_aarch64.dmg) |
| Windows | [Releases 页面](https://github.com/yuelangmanle/flowith/releases) |

**macOS 安装**：打开 .dmg → 拖入"应用程序" → 执行 `xattr -cr /Applications/Flowith.app` → 双击启动
**Windows 安装**：双击 .msi → 按提示安装 → 桌面图标启动

### 从源码运行

```bash
git clone https://github.com/yuelangmanle/flowith.git
cd flowith
npm install
npm run dev
```

访问 http://localhost:5173

---

## 🏗 技术架构

```
┌─────────────────────────────────────┐
│         Tauri Shell (Rust)           │
│  ┌───────────────────────────────┐  │
│  │     React 19 + TypeScript      │  │
│  │     Vite + Zustand             │  │
│  └───────────┬───────────────────┘  │
│              │ http://localhost:8787 │
│  ┌───────────▼───────────────────┐  │
│  │   Node.js HTTP Server          │  │
│  │   37 API Endpoints             │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

- **前端**: React 19 + TypeScript + Vite + Zustand + Lucide Icons
- **后端**: Node.js HTTP Server（零外部依赖）
- **桌面**: Tauri 2 (Rust)
- **测试**: Vitest + Testing Library（78 测试用例）

---

## 🛠 开发

```bash
# 开发模式（前端 + 后端热重载）
npm run dev

# 仅前端
npm run dev:web

# 仅后端
npm run dev:api

# 运行测试
npm run test

# 类型检查
npm run typecheck

# Tauri 开发模式
npm run tauri:dev

# 构建桌面应用
npm run tauri:build
```

---

## 📁 项目结构

```
flowith/
├── src/
│   ├── core/              # 核心业务逻辑
│   │   ├── modelGateway.ts    # 多模型 API 网关
│   │   ├── agentOrchestrator.ts # Agent 编排引擎
│   │   ├── roundtable.ts      # 圆桌讨论系统
│   │   ├── contextCompressor.ts # 上下文压缩引擎
│   │   ├── contextManager.ts  # 智能上下文管理
│   │   ├── tokenCounter.ts    # Token 计量器
│   │   └── memoryKnowledge.ts # 记忆知识系统
│   ├── views/             # UI 视图组件
│   ├── components/        # 通用组件
│   ├── lib/               # 工具库
│   └── server/            # Node.js 后端
├── src-tauri/             # Tauri 桌面应用
├── docs/download/         # 精美下载页
└── .github/workflows/     # CI/CD
```

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/amazing`
3. 提交更改：`git commit -m 'feat: add amazing feature'`
4. 推送分支：`git push origin feature/amazing`
5. 创建 Pull Request

---

## 📄 许可证

[MIT](LICENSE)

---

<p align="center">
  <sub>Made with ❤️ by Flowith Team</sub>
</p>
