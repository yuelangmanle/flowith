# Multi-Agent Workspace MVP Handoff

## What Exists

This repository now contains a local-first MVP for the multi-agent workspace platform described in:

- `docs/superpowers/specs/2026-05-27-multi-agent-workspace-design.md`
- `docs/superpowers/plans/2026-05-27-multi-agent-workspace-mvp.md`

The app provides:

- Workspace-first React UI.
- Deterministic multi-agent project generation flow.
- Multi-agent roundtable flow.
- Model provider registry and model discovery logic.
- Official documentation research helper.
- Traceable memory and knowledge/RAG primitives.
- Tool approval policy and dangerous command detection.
- Real Node local workspace runtime.
- Local API that writes generated project files into `.agent-workspaces/`.

## Run Commands

```bash
npm install
npm run dev
```

Open:

- Web UI: `http://127.0.0.1:5173/`
- API health: `http://127.0.0.1:8787/api/health`

## Verification Commands

```bash
npm test -- --run
npm run typecheck
npm run build
```

Current verified result:

- Tests: 8 files, 17 tests passed.
- Typecheck: passed.
- Build: passed.

## Important Files

- `src/App.tsx`: main workspace UI.
- `src/core/types.ts`: shared domain model.
- `src/core/modelGateway.ts`: provider config, model discovery, capability inference.
- `src/core/agentOrchestrator.ts`: deterministic project generation and roundtable flows.
- `src/core/workspaceRuntime.ts`: shared tool approval and command safety policy.
- `src/core/memoryKnowledge.ts`: memory and knowledge store primitives.
- `src/core/docsResearch.ts`: official docs research and Integration Note generation.
- `src/server/workspaceRuntime.node.ts`: real filesystem/command runtime.
- `src/server/index.ts`: local API server.
- `docs/progress/implementation-log.md`: chronological implementation notes.

## Demo Flow

1. Run `npm run dev`.
2. Open `http://127.0.0.1:5173/`.
3. Click `生成项目原型`.
4. The UI calls `POST http://127.0.0.1:8787/api/demo/run`.
5. The API creates `.agent-workspaces/ai-resume-optimizer-*`.
6. Generated files include `package.json`, `index.html`, `src/App.tsx`, `src/main.tsx`, `README.md`, and `docs/architecture.md`.

If the API is not running, the UI falls back to an in-browser deterministic flow and displays a notice.

## Current Limits

- Agent behavior is deterministic; it does not yet call real LLMs.
- Provider model discovery logic is implemented, but credentials and model management UI are still basic.
- RAG uses simple local scoring, not vector storage.
- Node runtime can write real files and run approved commands, but the UI does not yet expose a full approval queue experience for arbitrary commands.
- Docker sandboxing and team features are intentionally deferred.

## Next Engineering Steps

1. Add persistent storage for providers, runs, approvals, memory, and knowledge.
2. Wire real model calls through `ModelGateway`.
3. Add provider settings UI with credential test and model refresh.
4. Replace deterministic project generation with agent/tool loop.
5. Add real approval queue for install/run/delete/network actions.
6. Add workspace diff view and merge/export actions.
7. Replace simple retrieval with sqlite-vec/LanceDB.
8. Add Docker sandbox runtime behind the same runtime interface.
