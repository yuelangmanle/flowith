# Flowith

多 AI Agent 协作工作平台。支持多种模型供应商、圆桌讨论、代码生成和技能管理。

## 功能

- **多 Agent 协作** — 顺序、层级、圆桌讨论等多种编排模式
- **多模型支持** — OpenAI、Anthropic、DeepSeek、小米 MiMo、通义千问、Moonshot、Ollama
- **圆桌讨论** — 多个 AI 辩论投票，生成结构化报告
- **代码生成** — 从想法到代码的 AI 驱动全流程
- **技能系统** — 安装管理 AI 技能，支持联网搜索和本地导入
- **Token 优化** — 上下文压缩、缓存命中、智能 token 管理

## 安装

### 桌面应用（推荐）

从 [Releases](https://github.com/YOUR_USERNAME/flowith/releases) 下载：
- macOS: `Flowith_x.x.x_aarch64.dmg`
- Windows: `Flowith_x.x.x_x64-setup.nsis.exe`

### 从源码运行

```bash
git clone https://github.com/YOUR_USERNAME/flowith.git
cd flowith
npm install
npm run dev
```

访问 http://localhost:5173

## 开发

```bash
npm run dev          # 开发模式（前端 + 后端）
npm run test         # 运行测试
npm run tauri:dev    # Tauri 开发模式
npm run tauri:build  # 构建桌面应用
```

## 技术栈

- **前端**: React 19 + TypeScript + Vite + Zustand
- **后端**: Node.js HTTP Server
- **桌面**: Tauri 2 (Rust)
- **测试**: Vitest + Testing Library

## 许可证

MIT
