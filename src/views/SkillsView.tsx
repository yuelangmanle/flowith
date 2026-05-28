import { useState, useEffect, useRef } from "react";
import { Download, ExternalLink, FileUp, Globe, Loader2, Package, Search, Star, Trash2, Upload, X } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, uid } from "../lib/shared";
import type { Skill } from "../core/types";

// ─── 内置 Skills（全部中文描述）────────────────────────────────

const BUILT_IN_SKILLS: Skill[] = [
  // Obra Superpowers
  {
    id: "brainstorming", name: "Brainstorming", nameZh: "头脑风暴",
    description: "Structured brainstorming before creative work", descriptionZh: "在开始任何创意工作前进行结构化头脑风暴，帮助发散思维、收集想法、形成方案，避免遗漏关键角度",
    author: "Obra", repo: "https://github.com/obra/superpowers", category: "Planning", categoryZh: "规划",
    stars: 2800, installed: false, source: "builtin",
    capabilities: ["创意发散", "方案生成", "需求分析"], useCases: ["新功能设计", "技术方案讨论", "产品规划"],
  },
  {
    id: "tdd", name: "Test-Driven Development", nameZh: "测试驱动开发",
    description: "Write tests before implementation", descriptionZh: "先写测试再写代码的开发方法论，确保代码质量和功能正确性，减少回归 bug",
    author: "Obra", repo: "https://github.com/obra/superpowers", category: "Development", categoryZh: "开发",
    stars: 2800, installed: false, source: "builtin",
    capabilities: ["测试编写", "代码质量", "重构安全"], useCases: ["新功能开发", "bug 修复", "代码重构"],
  },
  {
    id: "systematic-debugging", name: "Systematic Debugging", nameZh: "系统化调试",
    description: "Root cause investigation before fixes", descriptionZh: "在修复 bug 前先系统化地调查根因，通过日志分析、断点调试、状态检查等方法定位问题本质",
    author: "Obra", repo: "https://github.com/obra/superpowers", category: "Debugging", categoryZh: "调试",
    stars: 2800, installed: false, source: "builtin",
    capabilities: ["根因分析", "日志解读", "状态追踪"], useCases: ["bug 排查", "性能问题", "异常行为分析"],
  },
  {
    id: "code-review", name: "Code Review", nameZh: "代码审查",
    description: "Request and receive structured code reviews", descriptionZh: "结构化的代码审查流程，检查代码质量、安全性、性能、可维护性，发现潜在问题并给出改进建议",
    author: "Obra", repo: "https://github.com/obra/superpowers", category: "Quality", categoryZh: "质量",
    stars: 2800, installed: false, source: "builtin",
    capabilities: ["代码质量检查", "安全审计", "性能分析"], useCases: ["PR 审查", "代码合并前检查", "技术债务评估"],
  },
  {
    id: "writing-plans", name: "Writing Plans", nameZh: "编写计划",
    description: "Create implementation plans from specs", descriptionZh: "根据需求规格创建详细的实现计划，拆分任务、评估工期、识别风险，为开发提供清晰路线图",
    author: "Obra", repo: "https://github.com/obra/superpowers", category: "Planning", categoryZh: "规划",
    stars: 2800, installed: false, source: "builtin",
    capabilities: ["任务拆分", "工期评估", "风险识别"], useCases: ["项目启动", "功能开发", "技术改造"],
  },
  {
    id: "verification", name: "Verification Before Completion", nameZh: "完成前验证",
    description: "Verify work before claiming completion", descriptionZh: "在声称任务完成前进行严格验证，确保所有测试通过、构建成功、功能正常，防止半成品交付",
    author: "Obra", repo: "https://github.com/obra/superpowers", category: "Quality", categoryZh: "质量",
    stars: 2800, installed: false, source: "builtin",
    capabilities: ["测试验证", "构建检查", "功能确认"], useCases: ["开发完成检查", "发布前验证", "部署前确认"],
  },
  {
    id: "subagent-dev", name: "Subagent-Driven Development", nameZh: "子代理驱动开发",
    description: "Execute plans with parallel sub-agents", descriptionZh: "将大型任务拆分给多个子代理并行执行，每个子代理独立完成子任务，最后汇总结果",
    author: "Obra", repo: "https://github.com/obra/superpowers", category: "Development", categoryZh: "开发",
    stars: 2800, installed: false, source: "builtin",
    capabilities: ["并行任务", "子代理调度", "结果汇总"], useCases: ["大型项目开发", "多模块并行", "批量处理"],
  },

  // CrewAI
  {
    id: "crewai-agents", name: "CrewAI Agents", nameZh: "CrewAI 多代理协作",
    description: "Multi-agent orchestration framework", descriptionZh: "多代理协作编排框架，支持角色定义、任务分配、顺序/层级/共识等多种协作模式",
    author: "CrewAI", repo: "https://github.com/crewAIInc/crewAI", category: "Framework", categoryZh: "框架",
    stars: 25000, installed: false, source: "builtin",
    capabilities: ["多代理协作", "角色编排", "任务分配"], useCases: ["团队协作模拟", "复杂任务分解", "自动化工作流"],
  },
  {
    id: "crewai-tools", name: "CrewAI Tools", nameZh: "CrewAI 工具集",
    description: "Pre-built tools for CrewAI agents", descriptionZh: "为 CrewAI 代理预构建的工具集，包括网页搜索、文件操作、代码执行、数据分析等常用能力",
    author: "CrewAI", repo: "https://github.com/crewAIInc/crewAI", category: "Tools", categoryZh: "工具",
    stars: 25000, installed: false, source: "builtin",
    capabilities: ["网页搜索", "文件操作", "数据分析"], useCases: ["信息收集", "自动化操作", "数据处理"],
  },

  // LangChain
  {
    id: "langchain-rag", name: "LangChain RAG", nameZh: "LangChain 检索增强",
    description: "Retrieval-augmented generation pipeline", descriptionZh: "检索增强生成（RAG）流水线，从文档库中检索相关内容并结合 LLM 生成准确回答，减少幻觉",
    author: "LangChain", repo: "https://github.com/langchain-ai/langchain", category: "RAG", categoryZh: "检索增强",
    stars: 98000, installed: false, source: "builtin",
    capabilities: ["文档检索", "知识问答", "上下文增强"], useCases: ["知识库问答", "文档分析", "技术支持"],
  },
  {
    id: "langgraph-workflow", name: "LangGraph Workflow", nameZh: "LangGraph 工作流",
    description: "Stateful multi-actor workflows", descriptionZh: "有状态的多参与者工作流引擎，支持条件分支、循环、并行执行，适合复杂的多步骤 AI 应用",
    author: "LangChain", repo: "https://github.com/langchain-ai/langgraph", category: "Workflow", categoryZh: "工作流",
    stars: 8000, installed: false, source: "builtin",
    capabilities: ["状态管理", "条件分支", "并行执行"], useCases: ["复杂流程自动化", "多步骤任务", "有状态对话"],
  },

  // Dify
  {
    id: "dify-workflow", name: "Dify Workflow", nameZh: "Dify 可视化工作流",
    description: "Visual LLM workflow builder", descriptionZh: "可视化 LLM 工作流构建器，通过拖拽式界面设计 AI 应用流程，支持多模型切换和工具集成",
    author: "Dify", repo: "https://github.com/langgenius/dify", category: "Workflow", categoryZh: "工作流",
    stars: 55000, installed: false, source: "builtin",
    capabilities: ["可视化编排", "多模型切换", "工具集成"], useCases: ["AI 应用构建", "流程设计", "快速原型"],
  },
  {
    id: "dify-rag", name: "Dify RAG Pipeline", nameZh: "Dify RAG 流水线",
    description: "Document indexing and retrieval", descriptionZh: "文档索引和检索流水线，支持多种文档格式导入、智能分块、向量化存储和语义检索",
    author: "Dify", repo: "https://github.com/langgenius/dify", category: "RAG", categoryZh: "检索增强",
    stars: 55000, installed: false, source: "builtin",
    capabilities: ["文档索引", "语义检索", "多格式支持"], useCases: ["企业知识库", "文档问答", "资料检索"],
  },

  // ChatDev
  {
    id: "chatdev", name: "ChatDev", nameZh: "ChatDev 虚拟软件公司",
    description: "Multi-agent software development simulation", descriptionZh: "多代理软件开发模拟系统，模拟虚拟软件公司的角色分工（CEO、CTO、程序员、测试等）协作开发软件",
    author: "OpenBMB", repo: "https://github.com/openbmb/ChatDev", category: "Development", categoryZh: "开发",
    stars: 25000, installed: false, source: "builtin",
    capabilities: ["角色模拟", "协作开发", "全栈生成"], useCases: ["快速原型开发", "团队协作模拟", "软件生成"],
  },

  // Browser / Web
  {
    id: "browser-use", name: "Browser Use", nameZh: "浏览器自动化",
    description: "AI-powered browser automation", descriptionZh: "AI 驱动的浏览器自动化工具，可以自动浏览网页、填写表单、提取数据、执行交互操作",
    author: "Browser Use", repo: "https://github.com/browser-use/browser-use", category: "Automation", categoryZh: "自动化",
    stars: 15000, installed: false, source: "builtin",
    capabilities: ["网页浏览", "表单填写", "数据提取"], useCases: ["自动化测试", "数据采集", "网页操作"],
  },
  {
    id: "web-scraper", name: "Web Scraper", nameZh: "智能网页爬虫",
    description: "Intelligent web content extraction", descriptionZh: "智能网页内容提取工具，能自动识别页面结构、提取正文、图片、链接等信息，支持反爬策略",
    author: "Community", repo: "https://github.com/unclecode/crawl4ai", category: "Data", categoryZh: "数据",
    stars: 12000, installed: false, source: "builtin",
    capabilities: ["内容提取", "结构识别", "反爬处理"], useCases: ["信息收集", "竞品分析", "内容聚合"],
  },

  // Memory / Knowledge
  {
    id: "mem0", name: "Mem0 Memory", nameZh: "Mem0 长期记忆",
    description: "Long-term memory for AI agents", descriptionZh: "AI 代理的长期记忆系统，能记住对话历史、用户偏好、学习到的知识，实现个性化交互",
    author: "Mem0", repo: "https://github.com/mem0ai/mem0", category: "Memory", categoryZh: "记忆",
    stars: 8000, installed: false, source: "builtin",
    capabilities: ["长期记忆", "偏好学习", "个性化"], useCases: ["个人助手", "持续对话", "用户画像"],
  },
  {
    id: "rag-knowledge", name: "RAG Knowledge Base", nameZh: "RAG 知识库",
    description: "Document-based knowledge retrieval", descriptionZh: "基于文档的知识检索系统，将文档转化为可检索的知识库，支持语义搜索和精确问答",
    author: "Community", repo: "https://github.com/run-llama/llama_index", category: "Knowledge", categoryZh: "知识",
    stars: 35000, installed: false, source: "builtin",
    capabilities: ["知识索引", "语义搜索", "精确问答"], useCases: ["企业知识管理", "技术文档查询", "学习辅助"],
  },

  // Code Generation
  {
    id: "aider", name: "Aider", nameZh: "Aider AI 结对编程",
    description: "AI pair programming in terminal", descriptionZh: "终端中的 AI 结对编程工具，能理解整个代码库、编辑多个文件、运行测试、自动修复错误",
    author: "Aider", repo: "https://github.com/paul-gauthier/aider", category: "Coding", categoryZh: "编程",
    stars: 28000, installed: false, source: "builtin",
    capabilities: ["代码编辑", "多文件操作", "自动测试"], useCases: ["日常开发", "代码重构", "bug 修复"],
  },
  {
    id: "swe-agent", name: "SWE-Agent", nameZh: "SWE 自主编程代理",
    description: "Autonomous software engineering agent", descriptionZh: "自主软件工程代理，能独立理解 issue、定位代码、编写修复方案并通过测试验证",
    author: "Princeton NLP", repo: "https://github.com/princeton-nlp/SWE-agent", category: "Coding", categoryZh: "编程",
    stars: 12000, installed: false, source: "builtin",
    capabilities: ["自主编程", "issue 修复", "代码理解"], useCases: ["自动修 bug", "issue 处理", "代码维护"],
  },

  // Data Analysis
  {
    id: "pandas-agent", name: "Pandas AI Agent", nameZh: "Pandas AI 数据分析",
    description: "Natural language data analysis", descriptionZh: "用自然语言进行数据分析，自动将描述转换为 Pandas 操作，生成图表和统计报告",
    author: "Community", repo: "https://github.com/Sinaptik-AI/pandas-ai", category: "Data", categoryZh: "数据",
    stars: 12000, installed: false, source: "builtin",
    capabilities: ["自然语言查询", "数据可视化", "统计分析"], useCases: ["数据探索", "报表生成", "趋势分析"],
  },

  // GitHub
  {
    id: "gh-actions", name: "GitHub Actions CI/CD", nameZh: "GitHub Actions CI/CD",
    description: "GitHub Actions workflow automation", descriptionZh: "GitHub Actions 工作流自动化，自动运行测试、构建、部署，修复 CI 失败问题",
    author: "GitHub", repo: "https://github.com/features/actions", category: "DevOps", categoryZh: "运维",
    stars: 0, installed: false, source: "builtin",
    capabilities: ["CI/CD", "自动测试", "自动部署"], useCases: ["持续集成", "自动发布", "CI 修复"],
  },
  {
    id: "gh-pr-review", name: "GitHub PR Review", nameZh: "GitHub PR 审查",
    description: "GitHub PR review and comment handling", descriptionZh: "GitHub PR 审查和评论处理，自动读取 review 意见、回复评论、根据反馈修改代码",
    author: "GitHub", repo: "https://github.com/features/actions", category: "Quality", categoryZh: "质量",
    stars: 0, installed: false, source: "builtin",
    capabilities: ["PR 审查", "评论处理", "代码修改"], useCases: ["PR 反馈处理", "代码评审", "协作开发"],
  },
];

const CATEGORIES_ZH = [
  { key: "all", label: "全部" },
  { key: "规划", label: "规划" },
  { key: "开发", label: "开发" },
  { key: "调试", label: "调试" },
  { key: "质量", label: "质量" },
  { key: "框架", label: "框架" },
  { key: "工具", label: "工具" },
  { key: "检索增强", label: "检索增强" },
  { key: "工作流", label: "工作流" },
  { key: "自动化", label: "自动化" },
  { key: "记忆", label: "记忆" },
  { key: "知识", label: "知识" },
  { key: "编程", label: "编程" },
  { key: "数据", label: "数据" },
  { key: "运维", label: "运维" },
  { key: "自定义", label: "自定义" },
  { key: "本地导入", label: "本地导入" },
  { key: "搜索结果", label: "搜索结果" },
];

export function SkillsView() {
  const { skills, setSkills, installSkill, uninstallSkill, showToast } = useStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [githubUrl, setGithubUrl] = useState("");
  const [installing, setInstalling] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Skill[]>([]);
  const [searching, setSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with built-in skills + installed from server
  useEffect(() => {
    // Merge built-in with any installed from server
    const init = async () => {
      let serverSkills: Skill[] = [];
      try {
        const resp = await apiFetch("/api/skills");
        if (resp.ok) serverSkills = await resp.json();
      } catch {}

      const merged = BUILT_IN_SKILLS.map((bs) => {
        const serverMatch = serverSkills.find((s) => s.id === bs.id);
        return serverMatch ? { ...bs, installed: true, installedAt: serverMatch.installedAt } : bs;
      });

      // Add server-only skills (github/local imports)
      for (const ss of serverSkills) {
        if (!merged.find((m) => m.id === ss.id)) {
          merged.push({ ...ss, installed: true });
        }
      }

      setSkills(merged);
    };
    init();
  }, []); // eslint-disable-line

  const installFromGithub = async () => {
    if (!githubUrl.trim()) return;
    setInstalling(true);
    try {
      const resp = await apiFetch("/api/skills/install-url", {
        method: "POST",
        body: JSON.stringify({ url: githubUrl }),
      });
      if (resp.ok) {
        const skill = await resp.json() as Skill;
        installSkill(skill);
        showToast(`已安装: ${skill.nameZh || skill.name}`, "success");
        setGithubUrl("");
      } else {
        const err = await resp.json() as { error: string };
        showToast(`安装失败: ${err.error}`, "error");
      }
    } catch {
      showToast("安装失败，请检查网络", "error");
    }
    setInstalling(false);
  };

  const searchOnline = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const resp = await apiFetch("/api/skills/search", {
        method: "POST",
        body: JSON.stringify({ query: searchQuery }),
      });
      if (resp.ok) {
        const results = await resp.json() as Skill[];
        setSearchResults(results);
      } else {
        showToast("搜索失败", "error");
      }
    } catch {
      showToast("搜索失败，请检查网络", "error");
    }
    setSearching(false);
  };

  const handleLocalImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async () => {
        const content = reader.result as string;
        try {
          const resp = await apiFetch("/api/skills/import-local", {
            method: "POST",
            body: JSON.stringify({
              name: file.name.replace(/\.(md|txt|json|yaml|yml)$/i, ""),
              content,
              description: content.slice(0, 200),
            }),
          });
          if (resp.ok) {
            const skill = await resp.json() as Skill;
            installSkill(skill);
            showToast(`已导入: ${skill.name}`, "success");
          }
        } catch {
          showToast("导入失败", "error");
        }
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const filtered = skills.filter((s) => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.nameZh.includes(search) ||
      s.descriptionZh.includes(search) ||
      s.capabilities?.some((c) => c.includes(search)) ||
      s.useCases?.some((u) => u.includes(search));
    const matchCategory = category === "all" || s.categoryZh === category;
    return matchSearch && matchCategory;
  });

  const installedCount = skills.filter((s) => s.installed).length;

  return (
    <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
      <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Package size={18} /> Skills 市场
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>已安装 {installedCount} / {skills.length}</span>
      </h3>

      {/* 安装来源：GitHub URL + 联网搜索 + 本地导入 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          placeholder="输入 GitHub URL 安装 Skill..."
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)", fontSize: 13 }}
          onKeyDown={(e) => { if (e.key === "Enter") installFromGithub(); }}
        />
        <button className="primary" onClick={installFromGithub} disabled={installing || !githubUrl.trim()} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {installing ? <Loader2 size={14} className="spin" /> : <Download size={14} />} 安装
        </button>
        <button className="icon-btn" onClick={() => setShowSearch(!showSearch)} title="联网搜索 Skills" style={{ padding: "8px", color: showSearch ? "var(--primary)" : "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 8 }}>
          <Globe size={16} />
        </button>
        <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="从本地文件导入" style={{ padding: "8px", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)" }}>
          <FileUp size={16} />
        </button>
        <input ref={fileInputRef} type="file" accept=".md,.txt,.json,.yaml,.yml" multiple onChange={handleLocalImport} style={{ display: "none" }} />
      </div>

      {/* 联网搜索面板 */}
      {showSearch && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              placeholder="搜索 GitHub 上的 AI Agent Skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13 }}
              onKeyDown={(e) => { if (e.key === "Enter") searchOnline(); }}
            />
            <button className="primary" onClick={searchOnline} disabled={searching} style={{ fontSize: 12, padding: "6px 12px" }}>
              {searching ? <Loader2 size={12} className="spin" /> : <Search size={12} />} 搜索
            </button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
              {searchResults.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: "var(--bg)", fontSize: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{r.name} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>by {r.author}</span></div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{r.description.slice(0, 80)}</div>
                  </div>
                  {r.stars ? <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>⭐ {r.stars > 1000 ? `${(r.stars / 1000).toFixed(1)}k` : r.stars}</span> : null}
                  <a href={r.repo} target="_blank" rel="noopener noreferrer" className="icon-btn" style={{ padding: 4 }}><ExternalLink size={12} /></a>
                  {r.installed ? (
                    <span style={{ fontSize: 11, color: "var(--primary)" }}>✓ 已安装</span>
                  ) : (
                    <button className="icon-btn" onClick={async () => {
                      if (r.repo) {
                        setGithubUrl(r.repo);
                        setShowSearch(false);
                      }
                    }} title="安装" style={{ padding: 4, color: "var(--primary)" }}>
                      <Download size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 搜索 + 分类过滤 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <Search size={14} style={{ color: "var(--text-muted)" }} />
          <input placeholder="搜索 Skills（名称、描述、能力标签）..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: "none", background: "transparent", flex: 1, fontSize: 13, color: "var(--text)" }} />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 13, color: "var(--text)" }}>
          {CATEGORIES_ZH.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>

      {/* Skills 网格 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
        {filtered.map((skill) => (
          <div key={skill.id} className="provider-card" style={{ padding: 14, cursor: "pointer" }} onClick={() => setExpandedId(expandedId === skill.id ? null : skill.id)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  {skill.nameZh}
                  {skill.name !== skill.nameZh && <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{skill.name}</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {skill.author} · {skill.categoryZh}
                  {skill.source === "github" && <span style={{ marginLeft: 4, padding: "1px 4px", borderRadius: 3, background: "rgba(77,150,255,0.1)", color: "var(--primary)", fontSize: 10 }}>GitHub</span>}
                  {skill.source === "local" && <span style={{ marginLeft: 4, padding: "1px 4px", borderRadius: 3, background: "rgba(107,203,119,0.1)", color: "#6BCB77", fontSize: 10 }}>本地</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {skill.stars ? <span style={{ fontSize: 11, color: "var(--text-muted)" }}>⭐ {skill.stars > 1000 ? `${(skill.stars / 1000).toFixed(1)}k` : skill.stars}</span> : null}
                {skill.repo && (
                  <a href={skill.repo} target="_blank" rel="noopener noreferrer" className="icon-btn" style={{ padding: 4 }} title="查看源码" onClick={(e) => e.stopPropagation()}>
                    <ExternalLink size={12} />
                  </a>
                )}
                <button
                  className={`icon-btn ${skill.installed ? "tts-active" : ""}`}
                  onClick={(e) => { e.stopPropagation(); skill.installed ? uninstallSkill(skill.id) : installSkill(skill); }}
                  title={skill.installed ? "卸载" : "安装"}
                  style={{ padding: 4, color: skill.installed ? "var(--accent)" : "var(--primary)" }}
                >
                  {skill.installed ? <Trash2 size={12} /> : <Download size={12} />}
                </button>
              </div>
            </div>

            {/* 中文描述 */}
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0", lineHeight: 1.5 }}>{skill.descriptionZh}</p>

            {/* 能力标签 */}
            {skill.capabilities && skill.capabilities.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {skill.capabilities.map((cap, i) => (
                  <span key={i} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{cap}</span>
                ))}
              </div>
            )}

            {/* 展开的使用场景 */}
            {expandedId === skill.id && skill.useCases && skill.useCases.length > 0 && (
              <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>💡 使用场景：</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {skill.useCases.map((uc, i) => (
                    <span key={i} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "rgba(78,205,196,0.1)", color: "var(--primary)" }}>{uc}</span>
                  ))}
                </div>
              </div>
            )}

            {/* 已安装标识 */}
            {skill.installed && (
              <div style={{ marginTop: 6, padding: "3px 8px", borderRadius: 4, background: "rgba(78,205,196,0.1)", color: "var(--primary)", fontSize: 11, display: "inline-block" }}>✓ 已安装</div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          <Package size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div>没有找到匹配的 Skills</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>尝试换个关键词搜索，或从 GitHub / 本地文件导入</div>
        </div>
      )}
    </div>
  );
}
