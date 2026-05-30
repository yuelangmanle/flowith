# Flowith 开发规范书

## 一、版本号管理

### 1.1 版本号规则（语义化版本）

格式: `MAJOR.MINOR.PATCH`

| 升级类型 | 说明 | 示例 |
|---------|------|------|
| **MAJOR** | 不兼容的重大变更（API 破坏性改动、架构重写） | 1.x.x → 2.0.0 |
| **MINOR** | 新功能向后兼容（新视图、新 Agent、新能力） | 1.3.x → 1.4.0 |
| **PATCH** | Bug 修复、小优化、UI 微调 | 1.3.7 → 1.3.8 |

### 1.2 版本号单一真相源

版本号维护在 **8 个位置**，通过脚本统一更新：

| 文件 | 字段 | 说明 |
|------|------|------|
| `package.json` | `version` | npm 包版本 |
| `src-tauri/tauri.conf.json` | `version` | Tauri 桌面端版本 |
| `android/app/build.gradle` | `versionName` | Android 版本名 |
| `android/app/build.gradle` | `versionCode` | Android 版本号（每次 +1） |
| `src/lib/version.ts` | `APP_VERSION` | **单一真相源**，前端从此导入 |
| `src/views/SettingsView.tsx` | 导入 version.ts | 桌面端设置页 |
| `src/mobile/MobileSettingsView.tsx` | 导入 version.ts | 手机端设置页 |
| `docs/download/index.html` | 下载链接文件名 | 下载页 |

### 1.3 版本更新流程

```bash
# 1. 使用脚本统一更新（推荐）
node scripts/bump-version.mjs 1.4.0

# 2. 构建验证
npm run build && npm test

# 3. 提交
git add -A && git commit -m "chore: bump version to v1.4.0"

# 4. 打 tag（触发云端打包）
git tag v1.4.0
git push origin main
git push origin v1.4.0

# 5. 等待 GitHub Actions 自动构建发布
# → https://github.com/yuelangmanle/flowith/actions
```

**绝对禁止手动逐文件改版本号。** 必须使用 `scripts/bump-version.mjs`。

---

## 二、迭代规则

### 2.1 迭代周期

| 类型 | 周期 | 说明 |
|------|------|------|
| Hotfix | 随时 | 严重 Bug、安全问题 → PATCH |
| 功能迭代 | 1-2 周 | 新功能 + Bug 修复 → MINOR |
| 大版本 | 1-3 月 | 架构变更、平台扩展 → MAJOR |

### 2.2 每次迭代必须包含

1. **版本号更新** — 使用 `bump-version.mjs`
2. **CHANGELOG 更新** — 写入 `CHANGELOG.md`（用户可见的变更）
3. **构建验证** — `npm run build && npm test` 全通过
4. **双端验证** — 桌面端和手机端都要测试核心功能
5. **打 Tag 发布** — `git tag v<x.y.z>` 触发 CI 打包

### 2.3 CHANGELOG 格式

```markdown
## v1.4.0 (2026-06-01)

### ✨ 新功能
- 功能描述

### 🔧 修复
- Bug 描述

### 📱 移动端
- 移动端专属变更

### 🖥️ 桌面端
- 桌面端专属变更
```

---

## 三、项目架构

### 3.1 目录结构

```
agent/
├── src/
│   ├── core/           # 核心业务逻辑（零 Node.js 依赖）
│   │   ├── agentConfig.ts      # Agent 预设配置
│   │   ├── agentOrchestrator.ts # Agent 对话编排
│   │   ├── apiHandlers.ts      # API 处理函数（桌面+移动端共用）
│   │   ├── codeGeneration.ts   # 代码生成引擎
│   │   ├── contextCompressor.ts # 上下文压缩
│   │   ├── contextManager.ts   # 上下文管理
│   │   ├── memoryKnowledge.ts  # 记忆系统
│   │   ├── memoryConsolidator.ts # 记忆整合
│   │   ├── modelGateway.ts     # 模型网关（API 调用）
│   │   ├── roundtable.ts       # 圆桌讨论
│   │   ├── tokenCounter.ts     # Token 计量
│   │   └── types.ts            # 类型定义
│   ├── lib/            # 前端工具库
│   │   ├── apiAdapter.ts       # API 适配层（HTTP/Direct）
│   │   ├── mobilePersistence.ts # 移动端 IndexedDB 持久化
│   │   ├── shared.ts           # 通用工具函数
│   │   ├── store.ts            # Zustand 全局状态
│   │   └── version.ts          # 版本号单一真相源
│   ├── views/          # 桌面端视图
│   ├── mobile/         # 移动端视图
│   ├── components/     # 共享组件
│   └── server/
│       └── index.ts    # Node.js HTTP 服务器（桌面端）
├── android/            # Capacitor Android 项目
├── src-tauri/          # Tauri 桌面端项目
├── docs/download/      # 下载页
└── scripts/            # 构建/版本脚本
```

### 3.2 双端架构

| 层级 | 桌面端 | 移动端 |
|------|--------|--------|
| UI | src/views/ | src/mobile/ |
| 共享组件 | src/components/ | src/components/ |
| 状态管理 | src/lib/store.ts | src/lib/store.ts |
| API 层 | HTTP → server/index.ts | DirectApiAdapter → apiHandlers.ts |
| 持久化 | 文件系统 (.agent-data/) | IndexedDB |
| 业务逻辑 | src/core/ | src/core/（完全复用） |

### 3.3 API 格式规范

所有 `PUT` 请求体必须使用包裹对象格式：

```typescript
// ✅ 正确
{ providers: [...] }
{ conversations: [...] }
{ skills: [...] }
{ configs: [...] }

// ❌ 错误（裸数组，服务端无法解析）
[...]
```

---

## 四、发布清单

每次发布前逐项检查：

- [ ] 版本号：`node scripts/bump-version.mjs <version>`
- [ ] 构建：`npm run build` 无错误
- [ ] 测试：`npm test` 全通过
- [ ] CHANGELOG：已更新
- [ ] 桌面端：核心功能手动验证
- [ ] 手机端：核心功能手动验证
- [ ] 提交：`git commit`
- [ ] Tag：`git tag v<version>`
- [ ] 推送：`git push origin main && git push origin v<version>`
- [ ] CI：GitHub Actions 构建成功
- [ ] 下载页：版本号正确、链接有效

---

## 五、常见陷阱

### 5.1 版本号遗漏更新

版本号散落在 8 个文件中。**必须使用脚本更新**，不要手动改。

### 5.2 API 格式不匹配

移动端 `apiFetch` 发送的数据格式必须与服务端 `handlePut*` 函数期望的格式一致。
- 服务端期望 `{ key: [...] }` 包裹格式
- 移动端不能发送裸数组

### 5.3 Release Workflow Detached HEAD

tag 触发的 CI 是 detached HEAD 状态。`publish-updater` job 必须 `checkout@v4` + `ref: main`。

### 5.4 Android versionCode

每次发版 `versionCode` 必须递增（+1），否则 Android 不允许安装更新。

