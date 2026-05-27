# Multi-Agent Workspace Platform Design

## Product Positioning

The product is a multi-agent workspace for individual developers first, with a path toward team automation later. The first version focuses on turning an idea into a runnable prototype through agent collaboration.

The main workflow is not a generic workflow builder. It is a workspace-centered development flow where agents clarify requirements, choose or accept a tech stack, generate code, run the project, fix failures, produce documentation, and store useful memory.

The long-term direction combines:

- Team AI automation platform.
- Multi-agent software development company.
- Configurable agent/workflow engine.
- Workspace runtime with isolated execution.
- Long-term memory and knowledge retrieval.

## MVP Success Criteria

The MVP is successful when a user can enter an idea, confirm a small number of decisions, and receive a runnable, previewable project directory with documentation and follow-up suggestions.

The first demo target should be:

1. User enters: "Build an AI resume optimization web app."
2. Product agent asks 3-5 clarifying questions.
3. Architecture agent recommends a tech stack, while the user can override it.
4. Agents generate an execution plan.
5. User confirms the plan.
6. Agents write files in an isolated workspace.
7. Dependency installation and command execution require approval.
8. The platform starts a local dev server.
9. A browser preview opens.
10. Agents perform at least one fix loop if startup fails.
11. README, architecture notes, and next steps are generated.
12. Useful project memory and official documentation references are saved.
13. User can start a multi-agent roundtable for improvement ideas.

## Scope

### In Scope For MVP

- Workspace-first user interface.
- Chat control console.
- Project/prototype generation template.
- Multi-agent default role template.
- Basic configurable agent structure.
- Multi-provider model configuration.
- Automatic model discovery.
- Official documentation research tool.
- Workspace copy and git worktree isolation.
- File read/write tools.
- Command execution with approval.
- Dependency installation with approval.
- Local preview.
- README and architecture document generation.
- Basic memory, knowledge base, and RAG.
- Multi-agent roundtable mode.
- Run logs and artifact management.

### Deferred

- Team multi-tenancy.
- Enterprise permission and audit system.
- Generic visual workflow canvas.
- Plugin marketplace.
- Docker sandbox runtime.
- Billing and cost accounting beyond basic usage visibility.
- Full production deployment platform.
- Arbitrary tech stack quality guarantees.
- Multiplayer real-time collaboration.

## Reference Projects

The platform should not directly fork one of the reference projects as its long-term base. It should own its product shell and architecture while borrowing ideas by module.

- Dify: reference model management, workflow concepts, knowledge base, and observability.
- CrewAI: reference agent/task/crew/flow abstractions.
- ChatDev: reference virtual software team roles and collaboration templates.
- agent-workspace: reference workspace isolation, git worktree usage, and terminal/session management.
- TencentDB-Agent-Memory: reference layered memory, context compression, and traceable sources.

## Core Modules

### Workspace Shell

The primary interface. It contains project navigation, task list, chat control console, file tree, diff view, terminal logs, browser preview, artifacts, and agent timeline.

### Agent Orchestrator

Coordinates agents, tasks, rounds, tool calls, approvals, retries, and final synthesis. It should be independent from any single model provider.

### Template And Flow Engine

Provides default flows:

- Generate project/prototype.
- Multi-agent roundtable.
- Later: implement feature, fix bug, write tests, refactor, write docs.

Templates define steps, roles, tool permissions, approval points, and expected artifacts. The first version can use structured configuration rather than a visual canvas.

### Model Gateway

All model calls go through a unified gateway:

```text
Agent -> Model Gateway -> Provider Adapter -> Vendor API / Local Model
```

Initial providers:

- OpenAI.
- Anthropic.
- Gemini.
- DeepSeek.
- Qwen / DashScope.
- Moonshot / Kimi.
- Ollama.
- Custom OpenAI-compatible endpoint.

Provider configuration should include base URL, API key, default model, enabled state, stream support, tool-calling support, JSON/structured-output support, vision support, context length, and optional pricing metadata.

### Tool Runtime

All file, command, browser, HTTP, package, database, and documentation research actions go through Tool Runtime. Agents cannot directly operate on the system outside this layer.

### Workspace Runtime

Execution environment for each task. MVP uses workspace copy and git worktree isolation. Docker sandboxing is deferred but should be anticipated in interfaces.

### Memory And Knowledge

Memory stores what the platform learns from use. Knowledge stores external/project information used for retrieval.

### Artifact Manager

Stores generated projects, reports, documentation, screenshots, discussion conclusions, and change summaries.

### Approval And Safety

Default policy: file writes inside the workspace can proceed automatically; dangerous actions require approval.

## User Flows

### Generate Project / Prototype

1. User enters a product idea.
2. Product agent clarifies requirements and constraints.
3. Architecture agent recommends a tech stack or accepts a user-selected stack.
4. The platform marks the selected stack as official-supported or experimental.
5. Moderator agent creates an execution plan.
6. User confirms the plan.
7. Product, architecture, development, UI, testing, documentation, and review agents collaborate.
8. Tools write files, install dependencies after approval, run commands after approval, and start preview.
9. Testing/development agents fix failures.
10. Documentation agent creates README and architecture notes.
11. Review agent checks omissions and quality.
12. Artifact manager saves outputs.
13. Memory and knowledge layers save useful conclusions.

### Multi-Agent Roundtable

Roundtable mode is an auxiliary feature, not the main execution path.

It supports casual discussion, brainstorming, product debate, post-project review, and idea refinement. User can choose agents or let the system recommend a set. A moderator agent sets the topic and round count, agents discuss, a critic agent challenges weak points, and the moderator summarizes conclusions.

Roundtable outputs can be converted into:

- New project idea.
- Requirements document.
- Task list.
- Project constraint.
- Long-term memory.

Unaccepted casual chat should remain ordinary conversation history and should not pollute long-term memory.

## Data Model

Core entities:

- User: credentials, preferences, approval policy, default stack.
- Provider: vendor configuration.
- Model: discovered or manually added model.
- Workspace: local project root or generated project directory.
- Project: product idea or actual project.
- Task: specific user goal.
- Agent: role, prompt, model, tools, memory permissions.
- Flow Template: steps, roles, approval points, artifacts.
- Run: one execution instance.
- Tool Call: file, command, HTTP, browser, package, database, or documentation action.
- Approval Request: dangerous action awaiting user decision.
- Artifact: generated code, docs, screenshots, reports, roundtable conclusions.
- Memory Item: layered memory with source traceability.
- Knowledge Source: document, code index, official docs, uploaded file, or generated report.

Important relationships:

- Run is the traceability center.
- Tool calls, artifacts, memories, and approvals should link back to a run.
- Memory should preserve source references rather than overwrite facts.
- Knowledge and memory are separate: knowledge is external/project content; memory is learned preference, decision, and experience.

## Model Discovery

Saving or testing a provider should trigger model discovery.

Strategies:

- OpenAI-compatible: call `/v1/models`.
- Ollama: call `/api/tags`.
- Gemini: call the Google model list API.
- Anthropic and providers without reliable model-list APIs: use built-in candidates plus manual model addition.
- Domestic providers: prefer official model-list APIs when available; otherwise built-in candidates plus manual refresh.

Discovered models are stored and not deleted just because a refresh fails. Models should carry capability metadata where possible:

- chat
- completion
- embedding
- vision
- tool calling
- JSON/structured output
- reasoning
- local
- fast
- cheap
- large context

Capabilities may come from provider APIs, built-in rules, user edits, or test calls.

## Official Documentation Research

Agents can use a controlled documentation research tool when implementing API integrations or selecting frameworks.

Rules:

- Prefer official documentation, official GitHub repositories, official API references, SDK docs, package registry metadata, and provider documentation.
- Save useful findings into the knowledge base with URL, fetch time, document version if available, SDK/API version if available, summary, and citation location.
- API integrations should produce an Integration Note containing auth method, endpoint, parameters, error handling, rate limits, SDK installation, minimal working example, and documentation sources.
- Official documentation overrides model memory when there is a conflict.
- Accessing non-official sites, downloading files, or executing documentation scripts requires user approval.

## Memory And RAG

Memory layers:

1. Raw Record: conversations, agent messages, tool outputs, errors, approvals.
2. Fact Memory: extracted facts.
3. Scenario Memory: reusable situational experience.
4. Persona / Preference Memory: user preferences and habits.
5. Project Memory: project-specific decisions, constraints, tasks, bugs, and run instructions.

Each memory item stores content, type, confidence, source run/message/tool call, creation time, last-used time, user confirmation state, cross-project availability, and retention/deletion flags.

Knowledge sources include official docs, API references, SDK docs, uploaded documents, project README files, code indexes, database schemas, task reports, and roundtable conclusions.

RAG should use hybrid retrieval:

- Keyword/BM25 for API names, code, symbols, and errors.
- Vector search for semantic questions.
- Metadata filters by project, source, time, and document type.
- Optional reranking later.

Context compression:

- Store raw content permanently unless retention settings remove it.
- Put summaries and reference IDs in model context.
- Fetch original details by ID when needed.

Long-term memory write policy:

- Save explicit "remember this" requests.
- Save key project decisions.
- Save successful and failed technical experience.
- Save repeated user preferences.
- Save API research conclusions.
- Save accepted roundtable conclusions.
- Do not save casual chat, low-value repeated logs, unaccepted ideas, or clearly wrong model output as long-term memory by default.

## Runtime And Safety

Execution starts in an isolated workspace:

```text
Project -> Task Run -> Workspace Snapshot / Git Worktree -> Agent Execution -> Diff / Artifact / Report
```

For generated projects, create a new project directory and initialize git. For existing projects, prefer git worktree. If the project is not a git repository, create a workspace snapshot.

Low-risk tools can run by default:

- Read files.
- Search code.
- Write or modify files inside current workspace.
- Generate documents.
- Read package metadata.
- Open local preview.

Require approval:

- Install dependencies.
- Delete files.
- Execute shell commands.
- Execute external scripts.
- Run database migrations.
- Access network.
- Read sensitive files such as `.env`, SSH config, or credentials.

Default forbidden without explicit enablement:

- Modify files outside workspace.
- Upload local files to external services.
- Read browser cookies.
- Execute system-level commands.
- Change system configuration.
- Delete large sets of files.
- Keep unknown long-running background processes.

Approval requests should show requesting agent, requested command/action, reason, impact, alternatives, risk level, and choices such as allow once, always allow for this task, or deny.

Command execution should enforce workspace working directory, timeout, stdout/stderr capture, long-output compression, limited retries, dangerous-command detection, and full tool-call logging.

## Interface Information Architecture

The main interface uses Workspace-first layout with chat as the control console.

Main areas:

- Left: projects, recent runs, task templates.
- Center: agent console, user input, planning, approvals, summaries.
- Right: file tree, diff, terminal logs, browser preview, artifacts, agent timeline.
- Top: current model, workspace, run status, token/cost summary, approval queue.
- Settings: providers, model discovery, agent config, tool permissions, memory management, official tech stacks.

## Technical Architecture Recommendation

Start local-first and keep cloud/team features optional later.

Recommended first stack:

- Frontend: Next.js, React, TypeScript.
- Backend: Python/FastAPI.
- Database: SQLite first, PostgreSQL later.
- Vector search: sqlite-vec or LanceDB first, pgvector later.
- Agent runtime: Python modules behind API boundaries.
- Workspace execution: local directories and git worktree.
- Model gateway: backend service/module.
- Preview: local dev server launched from workspace.

This split keeps the UI productive while using Python's stronger ecosystem for agents, RAG, document processing, and code execution.

## Development Order

1. Model gateway, provider configuration, and model discovery.
2. Workspace runtime and file/command tools.
3. Chat console and run logs.
4. Minimal agent orchestrator.
5. Project generation template.
6. Local preview and automatic fix loop.
7. Artifact documentation generation.
8. Memory, knowledge base, and RAG.
9. Official documentation research tool.
10. Multi-agent roundtable mode.
11. Configurable agents and flow templates.
12. Docker sandbox, team features, and workflow canvas later.

## Risks

The biggest risk is scope creep. The platform should control this by keeping the first version workspace-centered, using template-based flows, supporting an official tech stack list, deferring Docker, deferring team features, and treating the workflow canvas as a later product surface.

Agents must never bypass Tool Runtime. Every tool call should be logged, dangerous actions must be visible and rejectable, memory should not store secrets by default, and documentation research must prefer official sources.
