# Multi-Agent Workspace Platform - Handoff Document

## What Is This

A local-first multi-AI agent work platform. Users can configure AI model providers, chat with specialized agents, run multi-agent roundtable discussions, generate projects, and manage approvals for dangerous operations.

## Architecture

```
Frontend (React + Vite)  ←→  API Server (Node HTTP)  ←→  AI Provider APIs
     :5173                       :8787                   OpenAI/Anthropic/Gemini/...
```

- **Frontend**: `src/App.tsx` + `src/styles.css` - Workspace-first UI with dark theme.
- **Core logic**: `src/core/*.ts` - Business logic (pure TypeScript, no Node dependencies).
- **Server**: `src/server/*.ts` - Node HTTP API server.
- **Persistence**: localStorage (frontend) + in-memory (server).

## Run Commands

```bash
npm install
npm run dev          # Start both frontend (5173) and API (8787)
npm run dev:web      # Frontend only
npm run api          # API only
npm test -- --run    # Run tests
npm run typecheck    # TypeScript check
npm run build        # Production build
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/providers` | List providers |
| POST | `/api/providers` | Update provider |
| POST | `/api/providers/test` | Test provider connection |
| POST | `/api/providers/discover` | Discover models |
| GET | `/api/agents` | List agents |
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Create conversation |
| GET | `/api/conversations/:id` | Get conversation |
| DELETE | `/api/conversations/:id` | Delete conversation |
| POST | `/api/chat` | Send message (non-streaming) |
| POST | `/api/chat/stream` | Send message (SSE streaming) |
| POST | `/api/demo/run` | Run demo project generation |
| GET | `/api/workspaces` | List workspaces |
| GET | `/api/workspaces/:id/files` | List workspace files |
| GET | `/api/workspaces/:id/file/:path` | Read workspace file |

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main UI - Chat, Settings, Roundtable, Projects, Approvals |
| `src/styles.css` | Dark theme styles |
| `src/core/types.ts` | All TypeScript type definitions |
| `src/core/modelGateway.ts` | Provider config, model discovery, real API calls, streaming |
| `src/core/agentConfig.ts` | 11 agent definitions with system prompts |
| `src/core/agentOrchestrator.ts` | Agent chat, group chat, project generation |
| `src/core/persistence.ts` | localStorage persistence |
| `src/core/memoryKnowledge.ts` | Memory and knowledge base |
| `src/core/docsResearch.ts` | Official docs research |
| `src/core/workspaceRuntime.ts` | Tool approval policy |
| `src/core/artifacts.ts` | Document generation |
| `src/core/demoData.ts` | Default data and templates |
| `src/core/appState.ts` | UI state management |
| `src/server/index.ts` | API server (15+ endpoints) |
| `src/server/workspaceRuntime.node.ts` | Real filesystem runtime |

## Supported Providers

| Provider | Type | Streaming | Notes |
|----------|------|-----------|-------|
| OpenAI | openai | Yes | GPT-4.1, GPT-4o, o3-mini |
| Anthropic | anthropic | Yes | Claude Sonnet 4, Haiku 4 |
| Gemini | gemini | Yes | Gemini 2.5 Pro/Flash |
| DeepSeek | deepseek | Yes | deepseek-chat, deepseek-reasoner |
| Qwen/DashScope | qwen | Yes | qwen-plus, qwen-max |
| Moonshot/Kimi | moonshot | Yes | kimi-k2 |
| Ollama | ollama | Yes | Local models |
| Custom | openai-compatible | Yes | Any OpenAI-compatible API |

## Agents

11 specialized agents with system prompts:

1. 主持 Agent (Moderator) - Coordinates discussions
2. 产品 Agent (Product) - Requirements analysis
3. 架构 Agent (Architecture) - Technical design
4. 开发 Agent (Development) - Full-stack coding
5. UI Agent - Interface design
6. 测试 Agent (Testing) - QA and testing
7. 文档 Agent (Documentation) - Documentation writing
8. 评审 Agent (Review) - Code review
9. 反方 Agent (Critic) - Devil's advocate
10. 研究 Agent (Researcher) - Technical research
11. 编码 Agent (Coder) - Quick code implementation

## How To Use

1. Start: `npm run dev`
2. Open: `http://127.0.0.1:5173/`
3. Configure: Go to Settings, add API key for a provider
4. Chat: Create a new conversation, select an agent, start chatting
5. Roundtable: Go to roundtable view, select agents and topic
6. Projects: Use project templates for quick start
7. Approvals: Review and approve/deny dangerous operations

## Current Limits

- Conversations stored in localStorage (browser-only).
- Server stores conversations in memory (lost on restart).
- No user authentication or multi-tenancy.
- No Docker sandbox for command execution.
- RAG uses keyword scoring, not vector search.
- No real-time collaboration between users.

## Next Steps

1. Add persistent storage (SQLite) for conversations and projects.
2. Add user authentication.
3. Add Docker sandbox for safe command execution.
4. Replace keyword RAG with vector search (sqlite-vec/LanceDB).
5. Add workflow canvas for visual flow design.
6. Add team collaboration features.
7. Add cost tracking and token usage dashboard.
8. Add file upload and attachment support in chat.
