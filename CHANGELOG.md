# Flowith 更新日志

## v1.2.1 (2026-05-29)

### 🐛 macOS 安装修复
- **Ad-hoc 签名**: Tauri 构建现在使用 ad-hoc 签名，解决已损坏错误
- **安装指南更新**: 下载页和 README 添加 `xattr -cr` 说明
- **Gatekeeper 优化**: 用户可右键"打开"或执行命令解除限制

---

## v1.2.0 (2026-05-29)

### 🌐 下载页自动化
- **动态版本同步**: 页面加载时自动从 GitHub API 获取最新 release 信息和下载链接
- **CI 兜底**: Release workflow 自动更新下载页的静态版本号
- **功能对比表**: macOS / Windows / Android 平台功能支持矩阵
- **安装指南**: macOS、Windows、Android、源码运行的分步安装说明
- **系统要求**: 各平台最低配置说明

### 📱 安卓端架构
- **API 适配层** (`apiAdapter.ts`): 统一接口，自动选择 HTTP（桌面）或直调（移动端）
- **IndexedDB 持久层** (`mobilePersistence.ts`): 移动端数据持久化，替代服务器文件 I/O
- **API Handlers** (`apiHandlers.ts`): 从 server 提取的纯函数处理器，桌面/移动端共用
- **移动端 UI**: 底部 Tab 导航、对话页、圆桌讨论页、记忆、技能、设置
- **Capacitor 集成**: Android 打包配置就绪，支持 `npm run build:mobile`

### 🏗️ 架构改进
- `shared.ts` 的 `apiFetch` 现在通过适配器层路由，支持桌面和移动端
- `main.tsx` 自动检测运行环境，懒加载桌面或移动端入口
- 移动端入口作为独立 chunk 按需加载（56KB gzip 16KB）

---

## v1.1.1 (2026-05-29)

### 🔧 构建修复
- **修复 macOS x86_64 CI 构建失败**: `build-sidecar.mjs` 现在支持 `--target` 参数
- **修复 TypeScript 编译警告**: `tsconfig.node.json` 显式设置 `noEmit: false`

### 🐛 Bug 修复
- **修复 Skills 上下文缓存重复清理**: 移除 `contextManager.ts` 中重复的调用

### 🏗️ CI/CD
- Release workflow 传递 `--target` 给 build-sidecar 脚本
- 确保 macOS aarch64、macOS x86_64、Windows x86_64 三平台正确构建

---

## v1.1.0 (2026-05-29)

### 🧠 记忆系统完整增强
- **自动捕获**: 每轮对话后自动判断是否值得记忆
- **自动注入**: 每次对话自动搜索 top-5 相关记忆注入上下文
- **规则整合**: 频率规则、重要度规则驱动的短期→长期记忆晋升
- **自动去重**: Jaccard 相似度 > 0.7 自动合并
- **记忆管理界面**: 整合按钮、导出/导入、批量删除

### ⚡ Token 优化增强
- Anthropic prompt caching 增强
- 客户端 token 估算后备方案
- CJK 完整支持

---

## v1.0.0 (2026-05-28)

### 🎉 首个正式版本
- 多 Agent 协作平台（顺序/层级/圆桌三种模式）
- 支持 9+ AI 模型供应商
- 圆桌讨论（QQ 群聊式 UI、投票系统、结构化报告）
- Skills 技能市场
- 代码生成流水线
- L1-L4 分层记忆系统 + Token 优化
- Tauri 2 桌面打包（macOS + Windows）
- 暗色主题 + 拖拽上传 + 代码高亮 + 对话分支/置顶
- TTS 语音合成（MiMo、OpenAI、Edge、Fish Audio）
