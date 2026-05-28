# Implementation Log

## 2026-05-27

### Phase 1: Scaffold (v0.1.0)

- Created Vite/React/TypeScript project configuration.
- Added initial smoke test; verified it failed because the module was missing.
- Installed npm dependencies successfully with 0 reported vulnerabilities.
- Added minimal app shell and metadata to satisfy the first scaffold test.

### Phase 2: Core Modules (v0.1.0)

- Added `src/core/types.ts` for providers, models, agents, approvals, artifacts, memory, knowledge, and tool calls.
- Added `src/core/modelGateway.ts` with default providers, OpenAI-compatible discovery, Ollama discovery, fallbacks, stale model preservation, and capability inference.
- Added `src/core/memoryKnowledge.ts` with traceable memory items, retention flags, knowledge separation, metadata filters, and hybrid keyword scoring.
- Added `src/core/docsResearch.ts` with official-source detection, approval requirement for non-official URLs, citations, and Integration Note generation.
- Added `src/core/workspaceRuntime.ts` with approval policy, dangerous command detection, output compression, and tool-call records.
- Added `src/core/agentOrchestrator.ts` with deterministic project generation and roundtable flows.
- Added `src/core/appState.ts` for UI state transitions.
- Added `src/server/workspaceRuntime.node.ts` using Node fs/path/child_process.
- Added `src/server/index.ts` local API with health, demo run, and provider discovery endpoints.

### Phase 3: Full Platform (v0.2.0)

**Major rewrite to support real AI model integration, chat, multi-agent collaboration, and provider management.**

#### Type System Enhancement (`src/core/types.ts`)

- Added `ChatMessage`, `Conversation` types for conversation management.
- Added `StreamChunk` type for SSE streaming.
- Added `Project`, `GroupChatConfig` types.
- Added `AppView`, `ChatRequest`, `TestProviderRequest/Response` API types.
- Enhanced `ApprovalRequest` with `createdAt`, `conversationId`, `messageId`.
- Enhanced `AgentConfig` with `avatar`, `systemPrompt`, `providerId`, `color`.
- Added new agent roles: `coder`, `researcher`.

#### Local Persistence (`src/core/persistence.ts`)

- localStorage-based persistence for providers, conversations, and projects.
- `loadProviders/saveProviders` - provider configuration persistence.
- `loadConversations/saveConversation/deleteConversation` - conversation history.
- `loadProjects/saveProject/deleteProject` - project data.

#### Model Gateway Enhancement (`src/core/modelGateway.ts`)

- **Real API calling**: `callChatCompletion()` for non-streaming calls to any provider.
- **Streaming support**: `streamChatCompletion()` generator for SSE streaming.
- **Multi-provider support**: OpenAI-compatible, Anthropic (Messages API), Gemini (GenerateContent API).
- Provider-specific request/response format handling.
- Enhanced `discoverModels()` with Gemini models listing support.
- `getBestModelForTask()` for automatic model selection by task type.
- Updated fallback models with latest model IDs (gpt-4.1, claude-sonnet-4-20250514, gemini-2.5-pro, etc.).

#### Agent Configuration (`src/core/agentConfig.ts`)

- 11 default agents: Moderator, Product, Architecture, Development, UI, Testing, Documentation, Review, Critic, Researcher, Coder.
- Each agent has: avatar emoji, color, system prompt, tool list.
- `getAgentsForRoundtable()` - selects agents for roundtable discussion.
- `getAgentsForProjectGeneration()` - selects agents for project generation.

#### Agent Orchestrator Enhancement (`src/core/agentOrchestrator.ts`)

- `sendAgentMessage()` - send a message to an agent with real model call.
- `streamAgentMessage()` - stream an agent's response with real model streaming.
- `runGroupChat()` - coordinate multi-agent group discussion.
- Kept deterministic `runProjectGeneration()` and `runRoundtable()` as fallbacks.

#### App State Enhancement (`src/core/appState.ts`)

- Added `models`, `conversations`, `activeConversationId` to state.
- Added actions: `set-view`, `set-conversations`, `set-active-conversation`, `update-provider`, `set-models`, `set-agents`.
- Integrates with persistence layer for auto-save.

#### Server API Enhancement (`src/server/index.ts`)

- **Provider management**: `GET/POST /api/providers`, `POST /api/providers/test`, `POST /api/providers/discover`.
- **Agent listing**: `GET /api/agents`.
- **Conversation CRUD**: `GET/POST /api/conversations`, `GET/DELETE /api/conversations/:id`.
- **Chat (non-streaming)**: `POST /api/chat` with real model calls.
- **Chat (SSE streaming)**: `POST /api/chat/stream` with Server-Sent Events.
- **Workspace management**: `GET /api/workspaces`, `GET /api/workspaces/:id/files`, `GET /api/workspaces/:id/file/:path`.
- **Demo**: `POST /api/demo/run` for deterministic project generation demo.
- CORS support for all endpoints.

#### Frontend UI Rewrite (`src/App.tsx`)

**Complete workspace-first UI with dark theme:**

- **Left sidebar**: Navigation (Chat, Roundtable, Projects, Approvals, Settings), conversation list, official tech stacks.
- **Main content area**: Dynamic view switching between Chat, Settings, Roundtable, Projects, Approvals.
- **Right panel**: Agent list, model list, file info, platform info with tab switching.

**Chat View**:
- Real-time streaming chat with AI agents.
- Agent selection dropdown for choosing responding agent.
- Message bubbles with agent avatar, name, color, and timestamp.
- Typing indicator animation during streaming.
- Blinking cursor for streaming content.
- Simple Markdown rendering (headings, code blocks, inline code, bold, italic, lists).
- Empty state with quick-start buttons.
- API key warning when no provider is configured.

**Settings View**:
- Provider cards with enable/disable toggle.
- Expandable provider detail with API Base URL, API Key, Default Model fields.
- "Test Connection" button that calls `POST /api/providers/test`.
- "Discover Models" button that calls `POST /api/providers/discover`.
- Discovered model list with capability tags.
- Add custom OpenAI-compatible provider button.

**Roundtable View**:
- Topic input textarea.
- Round count slider (1-5).
- Agent selection grid with visual cards.
- Start roundtable button.

**Projects View**:
- Project template cards (AI Resume, Chat App, Dashboard, API Service).
- Official tech stack grid with status badges.

**Approvals View**:
- Approval queue with pending/approved/denied status.
- Risk level badges (low/medium/high).
- Approve/Deny buttons for pending items.

#### Styles Rewrite (`src/styles.css`)

- Dark theme with CSS custom properties.
- Professional SaaS-style color palette (blues, greens, neutrals).
- Responsive grid layout (3-column on desktop, single on mobile).
- Smooth animations (message entry, typing indicator, cursor blink).
- Custom scrollbar styling.
- Form inputs, toggles, badges, and cards.

### Verification Results

- `npm test -- --run`: 8 files, 27 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed (229KB JS, 18KB CSS).
- `curl http://127.0.0.1:8787/api/health`: returned ok.
- `curl http://127.0.0.1:5173/`: returned Multi-Agent Workspace HTML.
- All API endpoints tested and working.

### File Inventory

**New files:**
- `src/core/persistence.ts` - localStorage persistence layer.
- `src/core/agentConfig.ts` - Agent definitions and configuration.

**Major rewrites:**
- `src/core/types.ts` - Enhanced with conversations, messages, streaming, projects.
- `src/core/modelGateway.ts` - Real API calls, streaming, multi-provider support.
- `src/core/agentOrchestrator.ts` - Real model integration, group chat support.
- `src/core/appState.ts` - New state shape with conversations and models.
- `src/core/demoData.ts` - Updated metadata and project templates.
- `src/server/index.ts` - Complete API with 15+ endpoints.
- `src/App.tsx` - Complete UI rewrite with 6 views.
- `src/styles.css` - Complete dark theme rewrite.

**Updated tests:**
- `src/core/__tests__/smoke.test.ts`
- `src/core/__tests__/modelGateway.test.ts`
- `src/core/__tests__/appState.test.ts`
- `src/core/__tests__/agentOrchestrator.test.ts`
- `src/App.test.tsx`

### Current Handoff Point

The platform now supports:
1. Real AI model integration via OpenAI, Anthropic, Gemini, DeepSeek, Qwen, Moonshot, Ollama, and custom endpoints.
2. Streaming chat with agent selection.
3. Multi-agent roundtable discussions.
4. Provider settings with connection testing and model discovery.
5. Conversation persistence (localStorage).
6. Project generation templates.
7. Approval queue management.
8. Workspace file browsing.
9. Official documentation research.
10. Memory and knowledge base.

**To start using:**
1. `npm install && npm run dev`
2. Open `http://127.0.0.1:5173/`
3. Go to Settings, configure a provider with API Key.
4. Create a new chat and start talking to agents.

## 2026-05-27 (Bug Fix Round)

### Issues Found and Fixed

#### Critical Bug 1: Frontend-Server Provider Desync (FIXED)
**Problem**: Frontend edited providers in localStorage but never synced to server. Server used its own default providers (empty API keys). Testing connection always failed.
**Fix**: 
- Added `PUT /api/providers` endpoint for bulk sync.
- Frontend calls `syncProvidersToServer()` on load and on every provider change.
- Provider test/discover endpoints now accept optional `provider` in request body.

#### Critical Bug 2: Frontend-Server Conversation Desync (FIXED)
**Problem**: Frontend created conversations in localStorage only. Server didn't know about them. Sending chat messages returned 404.
**Fix**:
- Frontend creates conversations on server via `POST /api/conversations` when created locally.
- Server auto-creates conversations in chat endpoint if not found.
- Added `PUT /api/conversations` for bulk sync on frontend load.

#### Critical Bug 3: SSE Error Events Silently Swallowed (FIXED)
**Problem**: When server sent SSE error events, the `throw` inside try/catch was silently caught.
**Fix**: Moved error event handling outside the try/catch block. Added proper error propagation.

#### Bug 4: Chat Warning "设置" Link Did Nothing (FIXED)
**Problem**: `onClick={() => {}}` and `href="#"` did nothing.
**Fix**: Added `onNavigateToSettings` prop. Warning now navigates to settings view when clicked.

#### Bug 5: No Server-Side Persistence (FIXED)
**Problem**: Providers and conversations stored in memory only. Lost on server restart.
**Fix**: Added JSON file persistence in `.agent-data/` directory:
- `providers.json` - persisted on every provider update.
- `conversations.json` - persisted on every conversation create/update.

#### Bug 6: No Request Timeout (FIXED)
**Problem**: Chat endpoint blocked indefinitely on failed API calls.
**Fix**: Added 60s timeout for chat completion, 15s timeout for provider discovery.

#### Bug 7: Proxy Interference (DOCUMENTED)
**Problem**: System proxy (`ALL_PROXY=http://127.0.0.1:7890`) caused curl to fail when accessing localhost.
**Fix**: Frontend uses `window.location.hostname` for API base URL. Documented proxy bypass for CLI testing.

#### Bug 8: Frontend API_BASE Hardcoded (FIXED)
**Problem**: `http://127.0.0.1:8787` hardcoded.
**Fix**: Dynamic based on `window.location.hostname`.

### Verification

- 28 tests pass across 8 files.
- TypeScript typecheck passes.
- Build passes (232KB JS, 19KB CSS).
- API endpoints tested with curl: health, provider sync, conversation CRUD, provider test, persistence.
- Frontend loads correctly at http://127.0.0.1:5173/.
- Data persists in `.agent-data/` directory.

## 2026-05-27 (Engineering Iteration Round 2)

### Issues Found During Systematic Audit

#### Issue 1: `removeConversation` Closure Bug (FIXED)
**Problem**: `useCallback` captured stale `activeConvId` and `conversations` in closure.
**Fix**: Used functional updater for `setActiveConvId` inside `setConversations` callback. Eliminated stale closure dependencies.

#### Issue 2: Group Chat Endpoint Missing (FIXED)
**Problem**: Server had no `/api/group-chat` endpoint. Roundtable feature was UI-only without backend support.
**Fix**: Added full SSE streaming group-chat endpoint with multi-round, multi-agent discussion support.

#### Issue 3: ErrorBoundary Missing (FIXED)
**Problem**: Any React render error would crash the entire app with a white screen.
**Fix**: Added class-based `ErrorBoundary` component that catches render errors and shows a recovery UI.

#### Issue 4: Notice CSS Missing (FIXED)
**Problem**: Roundtable progress notices used `.notice` class but CSS was missing from dark theme.
**Fix**: Added `.notice` and `.notice.success` CSS rules.

### Verification Evidence

- `npm test -- --run`: 8 files, 28 tests passed (exit 0)
- `npm run typecheck`: passed (exit 0)
- `npm run build`: passed, 235KB JS + 19KB CSS (exit 0)
- `curl /api/health`: `{"ok":true,"providers":2,"conversations":2}`
- `curl /api/group-chat`: SSE stream with start/agent-start/agent-done/done events
- `curl http://127.0.0.1:5173/`: HTML with `<title>Multi-Agent Workspace</title>`
- Data persistence: `.agent-data/providers.json` and `.agent-data/conversations.json` verified

## 2026-05-27 (Engineering Iteration Round 3)

### Issues Found and Fixed

#### Issue 1: Streaming Endpoint No Timeout (FIXED)
**Problem**: If the AI provider hangs, the SSE connection stays open indefinitely.
**Fix**: Added 120s timeout for chat/stream, 300s timeout for group-chat. Timeout sends SSE error event and closes connection.

#### Issue 2: handleSend Fallback Handler Could Skip Save (FIXED)
**Problem**: The "save anyway" fallback checked `!updatedConv.messages.find(...)` which could fail if content matched.
**Fix**: Simplified to just check `if (fullContent)` - always save if we got content.

#### Issue 3: Duplicate Provider Lookup Logic (FIXED)
**Problem**: `enabledProvider` computed in both ChatView and RoundtableView with same logic.
**Fix**: Extracted `findEnabledProvider()` helper function.

#### Issue 4: Zero Test Coverage for Critical Functions (FIXED)
**Problem**: `callChatCompletion`, `streamChatCompletion`, `saveConversation`, `loadConversations` had no tests.
**Fix**: Added `persistence.test.ts` (6 tests) and `chatCompletion.test.ts` (4 tests) covering:
- Provider save/load/roundtrip
- Conversation CRUD (create, read, update, delete)
- Single conversation load by ID
- Corrupted localStorage graceful handling
- OpenAI-compatible API call format
- Anthropic API call format
- API error handling
- SSE streaming chunk parsing

### Verification Evidence

- `npm test -- --run`: 10 files, 38 tests passed (exit 0)
- `npm run typecheck`: passed (exit 0)
- `npm run build`: passed, 235KB JS + 19KB CSS (exit 0)
- New test files: `src/core/__tests__/persistence.test.ts`, `src/core/__tests__/chatCompletion.test.ts`
