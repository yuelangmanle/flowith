# Flowith 更新日志

## v1.1.1 (2026-05-29)

### 🔧 构建修复
- **修复 macOS x86_64 CI 构建失败**: `build-sidecar.mjs` 现在支持 `--target` 参数，用于 CI 交叉编译场景
- **修复 TypeScript 编译警告**: `tsconfig.node.json` 显式设置 `noEmit: false`

### 🐛 Bug 修复
- **修复 Skills 上下文缓存重复清理**: 移除 `contextManager.ts` 中重复的 `evictSkillsCacheIfNeeded()` 调用

### 🏗️ CI/CD
- Release workflow 传递 `--target` 给 build-sidecar 脚本
- 确保 macOS aarch64、macOS x86_64、Windows x86_64 三平台正确构建

---

## v1.1.0 (2026-05-29)

### 🧠 记忆系统完整增强
- **自动捕获**: 每轮对话后自动判断是否值得记忆，捕获关键信息
- **自动注入**: 每次对话时自动搜索 top-5 相关记忆注入到上下文
- **规则整合**: 频率规则（L1 关键词 ≥ 3 次 → 晋升 L3）、重要度规则（>0.7 → 晋升）
- **自动去重**: Jaccard 相似度 > 0.7 自动合并，0.4-0.7 自动关联
- **记忆管理界面**: 整合按钮、导出/导入、批量删除、关联查看
- **生命周期管理**: 每 10 分钟自动整合 + 清理过期记忆

### 🔍 搜索算法升级
- Jaccard 相似度替代简单关键词匹配
- 停用词过滤 + 关键词权重评分
- 多维度评分: jaccard × 0.4 + keyword × 0.3 + timeDecay × 0.2 + importance × 0.1

### 💬 圆桌讨论记忆集成
- 讨论前自动注入相关记忆
- 讨论结束后自动捕获结论为情景记忆

### ⚡ Token 优化增强
- Anthropic prompt caching 增强（缓存 system + 最后一条用户消息）
- 客户端 token 估算后备方案（provider 不返回 usage 时自动估算）
- CJK 完整支持（中日韩字符）
- 代码/JSON 感知估算

### 🔧 MiMo WebSearch 修复
- 修复 webSearchEnabled 错误

---

## v1.0.0 (2026-05-28)

### 🎉 首个正式版本

#### 核心功能
- 多 Agent 协作平台（顺序/层级/圆桌三种模式）
- 支持 9+ AI 模型供应商（OpenAI、Anthropic、Gemini、DeepSeek、Qwen、Moonshot、MiMo、Ollama）
- 圆桌讨论（QQ 群聊式 UI、投票系统、结构化报告）
- 代码生成流水线
- Skills 技能市场（搜索/安装/管理）

#### 记忆系统
- L1-L4 分层记忆架构
- Token-aware 上下文管理（替代固定 30 条）
- L1-L4 上下文压缩（媒体剥离、冗余清洗、渐进截断、语义压缩）

#### 桌面应用
- Tauri 2 打包（macOS DMG）
- 自动更新配置
- 首次启动引导向导

#### UI
- 暗色主题 + 小清新风格
- 拖拽上传 + 剪贴板粘贴
- 代码高亮 + 一键复制
- 流式输出停止按钮
- 长消息折叠/展开
- 对话分支 + 置顶
- 全局历史搜索

#### TTS 语音
- 小米 MiMo TTS
- OpenAI TTS
- Edge TTS（免费）
- Fish Audio
