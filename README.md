# Multi-Agent Workspace

多 AI Agent 协作工作台 — 让多个 AI Agent 帮你完成科研、开发和创意工作。

## 功能

- **多 Agent 对话**: 选择不同角色的 Agent 进行对话
- **圆桌会议**: 多 Agent 自由讨论，支持投票和结构化报告
- **代码生成**: 从需求到代码的全流程自动化
- **多供应商支持**: OpenAI、Anthropic、Gemini、DeepSeek、Qwen、Moonshot、Ollama
- **记忆系统**: L1-L4 分层记忆，支持长期知识积累
- **自定义 Agent**: 创建符合你需求的专属 Agent

## 快速开始

```bash
npm install
npm run dev
```

打开 http://127.0.0.1:5173/

## 文档

- [开发指南](docs/DEVELOPMENT.md)
- [v0.3.0 变更日志](docs/CHANGELOG-v0.3.0.md)
- [设计规格 v2](docs/superpowers/specs/2026-05-28-multi-agent-v2-design.md)

## 技术栈

- Frontend: React 19 + Vite + TypeScript
- Backend: Node.js + TypeScript
- 数据库: localStorage + JSON 文件（后续 PostgreSQL）
- AI: 多供应商模型网关

## 许可证

MIT
