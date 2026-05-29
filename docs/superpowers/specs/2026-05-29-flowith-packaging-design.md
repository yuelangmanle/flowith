# Flowith 打包方案设计文档

**日期**: 2026-05-29
**版本**: 1.0
**状态**: 已批准

## 概述

将 Multi-Agent Workspace 项目打包为桌面应用 "Flowith"，支持 macOS、Windows 和本地 Web 三种使用方式。采用 Tauri + Node Sidecar 架构。

## 决策记录

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 目标平台 | Mac + Win + Web | 覆盖主流桌面平台，Web 版本地可用 |
| 打包框架 | Tauri | 轻量 (~50MB)，Rust 生态，未来可扩展移动端 |
| 后端策略 | Node Sidecar | 零代码改动，保留全部 37 个 API 端点 |
| 数据存储 | App 专属目录 + 可自选 | 标准做法，支持用户自定义 |
| 自动更新 | GitHub Releases | 零服务器成本 |
| 首次体验 | 设置向导 | 引导用户配置 API Key |
| 分发方式 | GitHub Releases + GitHub Pages 下载页 | 免费，可靠 |
| App 名称 | Flowith | 体现"流动协作"理念 |
| 版本号 | 1.0.0 | 首个正式版 |

## 架构设计

### 整体架构

```
┌─────────────────────────────────────┐
│         Tauri Shell (Rust)           │
│  ┌───────────────────────────────┐  │
│  │     WebView (React Frontend)   │  │
│  │     dist/ → index.html         │  │
│  └───────────┬───────────────────┘  │
│              │ http://localhost:8787 │
│  ┌───────────▼───────────────────┐  │
│  │   Node.js Sidecar (8787)       │  │
│  │   37 API endpoints             │  │
│  │   数据 → AppData/Flowith       │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 开发模式 vs 打包模式

**开发模式**（不变）：
- `npm run dev` → Vite (5173) + tsx watch server (8787)
- 数据存储在项目目录 `.agent-data/`

**打包模式**：
- Node server 编译为单文件可执行程序
- Tauri 构建时自动打包
- App 启动时 Rust 端自动拉起 sidecar
- App 关闭时自动 kill server 进程
- 数据存储在系统 AppData 目录

## 实施细节

### 1. 项目结构

```
agent/
├── src-tauri/              # Tauri 配置 + Rust 代码
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/       # 权限配置
│   ├── icons/              # 平台图标
│   ├── binaries/           # Node server 二进制
│   └── src/
│       ├── main.rs         # Rust 入口
│       └── lib.rs          # sidecar 管理
├── src/                    # 前端代码（不变）
├── src/core/               # 核心逻辑（不变）
├── src/server/             # Node 后端（不变）
├── public/
│   └── icon.svg            # App 图标（已创建）
├── docs/
│   └── superpowers/specs/  # 设计文档
├── package.json            # 新增 tauri 脚本
└── Cargo.toml              # Rust workspace
```

### 2. Node Sidecar 构建

使用 `@yao-pkg/pkg` 将 Node server 编译为平台特定的单文件可执行程序：

- macOS: `server-macos-arm64` + `server-macos-x64`（Universal Binary）
- Windows: `server-windows-x64.exe`
- 放入 `src-tauri/binaries/`
- Tauri 构建时自动识别并打包

### 3. 数据目录管理

**默认路径**：
- macOS: `~/Library/Application Support/Flowith/`
- Windows: `%APPDATA%\Flowith\`

**数据迁移**：
- 首次启动检测旧数据目录（`.agent-data/`）
- 自动迁移到新位置
- 设置中可更改数据目录

### 4. 首次启动向导

步骤：
1. 欢迎页面 + 语言选择
2. 模型供应商选择（推荐 DeepSeek/小米 MiMo/本地 Ollama）
3. API Key 填入（可跳过）
4. 数据存储位置选择
5. 进入主界面

### 5. 自动更新

配置 Tauri updater：
- Endpoint: GitHub Releases `latest.json`
- 启动时静默检查
- 有新版弹窗提示
- 用户确认后下载并重启

### 6. 打包产物

| 平台 | 产物 | 大小估算 |
|------|------|----------|
| macOS | `.dmg`（Universal Binary） | ~55MB |
| Windows | `.msi` + `.exe` | ~50MB |
| Web | `dist/` + 启动脚本 | 0（本地运行） |

### 7. 下载页

GitHub Pages 静态单页网站：
- Flowith logo + 简介
- Mac / Windows / Web 下载按钮
- 系统要求说明
- GitHub 仓库链接

## API 地址处理

打包模式下，前端需要知道 Node server 的地址：
- 开发模式: `http://localhost:5173` → `http://localhost:8787`
- 打包模式: Tauri WebView 加载 `tauri://localhost` → 需要连接 `http://localhost:8787`

方案：前端 `API_BASE` 检测环境，自动选择正确的后端地址。

## 测试计划

1. macOS 构建 + 安装 + 启动测试
2. Windows 构建 + 安装 + 启动测试
3. 首次启动向导流程测试
4. 自动更新流程测试
5. 数据迁移测试
6. 现有 78 个单元测试通过

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Node sidecar 体积大 | 安装包 ~50MB | 后续可考虑 Rust 重写 |
| macOS 签名问题 | 未签名 App 首次打开需手动允许 | 提供安装说明 |
| Windows Defender 误报 | 未签名 exe 可能被拦截 | 提供安装说明 |
| Node server 崩溃 | App 无法使用 | Rust 端监控进程，自动重启 |
