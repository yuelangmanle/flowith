import { useState, useRef, useEffect } from "react";
import {
  Download, ExternalLink, FileUp, Globe, Loader2, Package, RefreshCw,
  Search, Star, Trash2, Upload, X, ChevronDown, ChevronRight,
} from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, uid } from "../lib/shared";
import type { Skill } from "../core/types";


// ─── 内置 Skills（全部中文描述）────────────────────────────────
const BUILT_IN_SKILLS: Skill[] = [
  // Obra Superpowers
  { id: "brainstorming", name: "Brainstorming", nameZh: "头脑风暴", description: "Structured brainstorming before creative work", descriptionZh: "在开始任何创意工作前进行结构化头脑风暴，帮助发散思维、收集想法、形成方案，避免遗漏关键角度", author: "Obra", repo: "https://github.com/obra/superpowers", category: "Planning", categoryZh: "规划", stars: 2800, installed: false, source: "builtin", capabilities: ["创意发散", "方案生成", "需求分析"], useCases: ["新功能设计", "技术方案讨论", "产品规划"] },
  { id: "tdd", name: "Test-Driven Development", nameZh: "测试驱动开发", description: "Write tests before implementation", descriptionZh: "先写测试再写代码的开发方法论，确保代码质量和功能正确性，减少回归 bug", author: "Obra", repo: "https://github.com/obra/superpowers", category: "Development", categoryZh: "开发", stars: 2800, installed: false, source: "builtin", capabilities: ["测试编写", "代码质量", "重构安全"], useCases: ["新功能开发", "bug 修复", "代码重构"] },
  { id: "systematic-debugging", name: "Systematic Debugging", nameZh: "系统化调试", description: "Root cause investigation before fixes", descriptionZh: "在修复 bug 前先系统化地调查根因，通过日志分析、断点调试、状态检查等方法定位问题本质", author: "Obra", repo: "https://github.com/obra/superpowers", category: "Debugging", categoryZh: "调试", stars: 2800, installed: false, source: "builtin", capabilities: ["根因分析", "日志解读", "状态追踪"], useCases: ["bug 排查", "性能问题", "异常行为分析"] },
  { id: "code-review", name: "Code Review", nameZh: "代码审查", description: "Request and receive structured code reviews", descriptionZh: "结构化的代码审查流程，检查代码质量、安全性、性能、可维护性，发现潜在问题并给出改进建议", author: "Obra", repo: "https://github.com/obra/superpowers", category: "Quality", categoryZh: "质量", stars: 2800, installed: false, source: "builtin", capabilities: ["代码质量检查", "安全审计", "性能分析"], useCases: ["PR 审查", "代码合并前检查", "技术债务评估"] },
  { id: "writing-plans", name: "Writing Plans", nameZh: "编写计划", description: "Create implementation plans from specs", descriptionZh: "根据需求规格创建详细的实现计划，拆分任务、评估工期、识别风险，为开发提供清晰路线图", author: "Obra", repo: "https://github.com/obra/superpowers", category: "Planning", categoryZh: "规划", stars: 2800, installed: false, source: "builtin", capabilities: ["任务拆分", "工期评估", "风险识别"], useCases: ["项目启动", "功能开发", "技术改造"] },
  { id: "verification", name: "Verification Before Completion", nameZh: "完成前验证", description: "Verify work before claiming completion", descriptionZh: "在声称任务完成前进行严格验证，确保所有测试通过、构建成功、功能正常，防止半成品交付", author: "Obra", repo: "https://github.com/obra/superpowers", category: "Quality", categoryZh: "质量", stars: 2800, installed: false, source: "builtin", capabilities: ["测试验证", "构建检查", "功能确认"], useCases: ["开发完成检查", "发布前验证", "部署前确认"] },
  { id: "subagent-dev", name: "Subagent-Driven Development", nameZh: "子代理驱动开发", description: "Execute plans with parallel sub-agents", descriptionZh: "将大型任务拆分给多个子代理并行执行，每个子代理独立完成子任务，最后汇总结果", author: "Obra", repo: "https://github.com/obra/superpowers", category: "Development", categoryZh: "开发", stars: 2800, installed: false, source: "builtin", capabilities: ["并行任务", "子代理调度", "结果汇总"], useCases: ["大型项目开发", "多模块并行", "批量处理"] },
  // CrewAI
  { id: "crewai-agents", name: "CrewAI Agents", nameZh: "CrewAI 多代理协作", description: "Multi-agent orchestration framework", descriptionZh: "多代理协作编排框架，支持角色定义、任务分配、顺序/层级/共识等多种协作模式", author: "CrewAI", repo: "https://github.com/crewAIInc/crewAI", category: "Framework", categoryZh: "框架", stars: 25000, installed: false, source: "builtin", capabilities: ["多代理协作", "角色编排", "任务分配"], useCases: ["团队协作模拟", "复杂任务分解", "自动化工作流"] },
  { id: "crewai-tools", name: "CrewAI Tools", nameZh: "CrewAI 工具集", description: "Pre-built tools for CrewAI agents", descriptionZh: "为 CrewAI 代理预构建的工具集，包括网页搜索、文件操作、代码执行、数据分析等常用能力", author: "CrewAI", repo: "https://github.com/crewAIInc/crewAI", category: "Tools", categoryZh: "工具", stars: 25000, installed: false, source: "builtin", capabilities: ["网页搜索", "文件操作", "数据分析"], useCases: ["信息收集", "自动化操作", "数据处理"] },
  // LangChain
  { id: "langchain-rag", name: "LangChain RAG", nameZh: "LangChain 检索增强", description: "Retrieval-augmented generation pipeline", descriptionZh: "检索增强生成（RAG）流水线，从文档库中检索相关内容并结合 LLM 生成准确回答，减少幻觉", author: "LangChain", repo: "https://github.com/langchain-ai/langchain", category: "RAG", categoryZh: "检索增强", stars: 98000, installed: false, source: "builtin", capabilities: ["文档检索", "上下文增强", "知识问答"], useCases: ["知识库问答", "文档搜索", "信息综合"] },
  { id: "langchain-tools", name: "LangChain Tools", nameZh: "LangChain 工具生态", description: "Tool integration ecosystem", descriptionZh: "LangChain 工具生态系统，集成搜索引擎、数据库、API 等各种外部工具，扩展 AI 代理能力边界", author: "LangChain", repo: "https://github.com/langchain-ai/langchain", category: "Tools", categoryZh: "工具", stars: 98000, installed: false, source: "builtin", capabilities: ["工具集成", "API 调用", "外部服务"], useCases: ["能力扩展", "数据源接入", "服务编排"] },
  // AutoGPT
  { id: "autogpt", name: "AutoGPT", nameZh: "AutoGPT 自主代理", description: "Autonomous GPT agent", descriptionZh: "自主运行的 GPT 代理，能自动分解目标、制定计划、执行任务、自我纠错，实现端到端的自动化任务完成", author: "Significant Gravitas", repo: "https://github.com/Significant-Gravitas/AutoGPT", category: "Framework", categoryZh: "框架", stars: 170000, installed: false, source: "builtin", capabilities: ["自主执行", "目标分解", "自我纠错"], useCases: ["自动化任务", "复杂项目", "端到端完成"] },
  // MetaGPT
  { id: "metagpt", name: "MetaGPT", nameZh: "MetaGPT 元编程", description: "Multi-agent meta-programming", descriptionZh: "多代理元编程框架，模拟软件公司组织结构（产品经理、架构师、工程师等），通过标准化 SOP 协作完成软件开发", author: "DeepWisdom", repo: "https://github.com/geekan/MetaGPT", category: "Framework", categoryZh: "框架", stars: 55000, installed: false, source: "builtin", capabilities: ["元编程", "SOP 流程", "角色分工"], useCases: ["软件开发", "产品设计", "团队模拟"] },
  // LangGraph
  { id: "langgraph", name: "LangGraph", nameZh: "LangGraph 状态图工作流", description: "Graph-based agent workflows", descriptionZh: "基于图的代理工作流引擎，支持循环、分支、并行等复杂流程编排，实现有状态的多步骤 AI 应用", author: "LangChain", repo: "https://github.com/langchain-ai/langgraph", category: "Workflow", categoryZh: "工作流", stars: 8000, installed: false, source: "builtin", capabilities: ["状态管理", "条件分支", "并行执行"], useCases: ["复杂流程自动化", "多步骤任务", "有状态对话"] },
  // Dify
  { id: "dify-workflow", name: "Dify Workflow", nameZh: "Dify 可视化工作流", description: "Visual LLM workflow builder", descriptionZh: "可视化 LLM 工作流构建器，通过拖拽式界面设计 AI 应用流程，支持多模型切换和工具集成", author: "Dify", repo: "https://github.com/langgenius/dify", category: "Workflow", categoryZh: "工作流", stars: 55000, installed: false, source: "builtin", capabilities: ["可视化编排", "多模型切换", "工具集成"], useCases: ["AI 应用构建", "流程设计", "快速原型"] },
  { id: "dify-rag", name: "Dify RAG Pipeline", nameZh: "Dify RAG 流水线", description: "Document indexing and retrieval", descriptionZh: "文档索引和检索流水线，支持多种文档格式导入、智能分块、向量化存储和语义检索", author: "Dify", repo: "https://github.com/langgenius/dify", category: "RAG", categoryZh: "检索增强", stars: 55000, installed: false, source: "builtin", capabilities: ["文档索引", "语义检索", "多格式支持"], useCases: ["企业知识库", "文档问答", "资料检索"] },
  // ChatDev
  { id: "chatdev", name: "ChatDev", nameZh: "ChatDev 虚拟软件公司", description: "Multi-agent software development simulation", descriptionZh: "多代理软件开发模拟系统，模拟虚拟软件公司的角色分工（CEO、CTO、程序员、测试等）协作开发软件", author: "OpenBMB", repo: "https://github.com/openbmb/ChatDev", category: "Development", categoryZh: "开发", stars: 25000, installed: false, source: "builtin", capabilities: ["角色模拟", "协作开发", "全栈生成"], useCases: ["快速原型开发", "团队协作模拟", "软件生成"] },
  // Browser / Web
  { id: "browser-use", name: "Browser Use", nameZh: "浏览器自动化", description: "AI-powered browser automation", descriptionZh: "AI 驱动的浏览器自动化工具，可以自动浏览网页、填写表单、提取数据、执行交互操作", author: "Browser Use", repo: "https://github.com/browser-use/browser-use", category: "Automation", categoryZh: "自动化", stars: 15000, installed: false, source: "builtin", capabilities: ["网页浏览", "表单填写", "数据提取"], useCases: ["自动化测试", "数据采集", "网页操作"] },
  { id: "web-scraper", name: "Web Scraper", nameZh: "智能网页爬虫", description: "Intelligent web content extraction", descriptionZh: "智能网页内容提取工具，能自动识别页面结构、提取正文、图片、链接等信息，支持反爬策略", author: "Community", repo: "https://github.com/unclecode/crawl4ai", category: "Data", categoryZh: "数据", stars: 12000, installed: false, source: "builtin", capabilities: ["内容提取", "结构识别", "反爬处理"], useCases: ["信息收集", "竞品分析", "内容聚合"] },
  // Memory / Knowledge
  { id: "mem0", name: "Mem0 Memory", nameZh: "Mem0 长期记忆", description: "Long-term memory for AI agents", descriptionZh: "AI 代理的长期记忆系统，能记住对话历史、用户偏好、学习到的知识，实现个性化交互", author: "Mem0", repo: "https://github.com/mem0ai/mem0", category: "Memory", categoryZh: "记忆", stars: 8000, installed: false, source: "builtin", capabilities: ["长期记忆", "偏好学习", "个性化"], useCases: ["个人助手", "持续对话", "用户画像"] },
  { id: "rag-knowledge", name: "RAG Knowledge Base", nameZh: "RAG 知识库", description: "Document-based knowledge retrieval", descriptionZh: "基于文档的知识检索系统，将文档转化为可检索的知识库，支持语义搜索和精确问答", author: "Community", repo: "https://github.com/run-llama/llama_index", category: "Knowledge", categoryZh: "知识", stars: 35000, installed: false, source: "builtin", capabilities: ["知识索引", "语义搜索", "精确问答"], useCases: ["企业知识管理", "技术文档查询", "学习辅助"] },
  // Code Generation
  { id: "aider", name: "Aider", nameZh: "Aider AI 结对编程", description: "AI pair programming in terminal", descriptionZh: "终端中的 AI 结对编程工具，能理解整个代码库、编辑多个文件、运行测试、自动修复错误", author: "Aider", repo: "https://github.com/paul-gauthier/aider", category: "Coding", categoryZh: "编程", stars: 28000, installed: false, source: "builtin", capabilities: ["代码编辑", "多文件操作", "自动测试"], useCases: ["日常开发", "代码重构", "bug 修复"] },
  { id: "swe-agent", name: "SWE-Agent", nameZh: "SWE 自主编程代理", description: "Autonomous software engineering agent", descriptionZh: "自主软件工程代理，能独立理解 issue、定位代码、编写修复方案并通过测试验证", author: "Princeton NLP", repo: "https://github.com/princeton-nlp/SWE-agent", category: "Coding", categoryZh: "编程", stars: 12000, installed: false, source: "builtin", capabilities: ["自主编程", "issue 修复", "代码理解"], useCases: ["自动修 bug", "issue 处理", "代码维护"] },
  // Data Analysis
  { id: "pandas-agent", name: "Pandas AI Agent", nameZh: "Pandas AI 数据分析", description: "Natural language data analysis", descriptionZh: "用自然语言进行数据分析，自动将描述转换为 Pandas 操作，生成图表和统计报告", author: "Community", repo: "https://github.com/Sinaptik-AI/pandas-ai", category: "Data", categoryZh: "数据", stars: 12000, installed: false, source: "builtin", capabilities: ["自然语言查询", "数据可视化", "统计分析"], useCases: ["数据探索", "报表生成", "趋势分析"] },
  // GitHub
  { id: "gh-actions", name: "GitHub Actions CI/CD", nameZh: "GitHub Actions CI/CD", description: "GitHub Actions workflow automation", descriptionZh: "GitHub Actions 工作流自动化，自动运行测试、构建、部署，修复 CI 失败问题", author: "GitHub", repo: "https://github.com/features/actions", category: "DevOps", categoryZh: "运维", stars: 0, installed: false, source: "builtin", capabilities: ["CI/CD", "自动测试", "自动部署"], useCases: ["持续集成", "自动发布", "CI 修复"] },
  { id: "gh-pr-review", name: "GitHub PR Review", nameZh: "GitHub PR 审查", description: "GitHub PR review and comment handling", descriptionZh: "GitHub PR 审查和评论处理，自动读取 review 意见、回复评论、根据反馈修改代码", author: "GitHub", repo: "https://github.com/features/actions", category: "Quality", categoryZh: "质量", stars: 0, installed: false, source: "builtin", capabilities: ["PR 审查", "评论处理", "代码修改"], useCases: ["PR 反馈处理", "代码评审", "协作开发"] },
];

const CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "installed", label: "已安装" },
  { id: "规划", label: "规划" },
  { id: "开发", label: "开发" },
  { id: "调试", label: "调试" },
  { id: "质量", label: "质量" },
  { id: "框架", label: "框架" },
  { id: "工具", label: "工具" },
  { id: "检索增强", label: "检索增强" },
  { id: "工作流", label: "工作流" },
  { id: "自动化", label: "自动化" },
  { id: "记忆", label: "记忆" },
  { id: "知识", label: "知识" },
  { id: "编程", label: "编程" },
  { id: "数据", label: "数据" },
  { id: "运维", label: "运维" },
  { id: "自定义", label: "自定义" },
  { id: "搜索结果", label: "搜索结果" },
];

export function MobileSkillsView() {
  const { skills, setSkills, showToast } = useStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showGithubInstall, setShowGithubInstall] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [installing, setInstalling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merge built-in skills with API results on mount
  useEffect(() => {
    const init = async () => {
      try {
        const resp = await apiFetch("/api/skills");
        const serverSkills: Skill[] = resp.ok ? await resp.json() : [];
        const merged = BUILT_IN_SKILLS.map((bs) => {
          const serverMatch = serverSkills.find((s) => s.id === bs.id);
          return serverMatch ? { ...bs, installed: true, installedAt: (serverMatch as any).installedAt } : bs;
        });
        for (const ss of serverSkills) {
          if (!merged.find((m) => m.id === ss.id)) {
            merged.push({ ...ss, installed: true });
          }
        }
        setSkills(merged);
      } catch {
        setSkills(BUILT_IN_SKILLS);
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter
  const filtered = skills.filter((s) => {
    if (activeCategory === "installed") return s.installed || s.source === "builtin";
    if (activeCategory !== "all") return s.categoryZh === activeCategory || s.category === activeCategory;
    return true;
  }).filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.nameZh.includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.descriptionZh.includes(q) ||
      (s.capabilities ?? []).some((c) => c.includes(q))
    );
  });

  const installSkill = async (skill: Skill) => {
    const updated = { ...skill, installed: true, installedAt: new Date().toISOString() };
    setSkills((prev) => prev.map((s) => (s.id === skill.id ? updated : s)));
    try {
      await apiFetch("/api/skills", { method: "PUT", body: JSON.stringify(skills.map((s) => (s.id === skill.id ? updated : s))) });
    } catch {}
    showToast(`已安装 ${skill.nameZh}`, "success");
  };

  const uninstallSkill = async (id: string) => {
    const updated = skills.map((s) => (s.id === id ? { ...s, installed: false } : s));
    setSkills(updated);
    try { await apiFetch("/api/skills", { method: "PUT", body: JSON.stringify(updated) }); } catch {}
    showToast("已卸载", "success");
  };

  const handleGithubInstall = async () => {
    if (!githubUrl.trim()) return;
    setInstalling(true);
    try {
      const resp = await apiFetch("/api/skills/install-github", {
        method: "POST",
        body: JSON.stringify({ url: githubUrl.trim() }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { skill: Skill };
        setSkills((prev) => [...prev.filter((s) => s.id !== data.skill.id), { ...data.skill, installed: true }]);
        setGithubUrl("");
        setShowGithubInstall(false);
        showToast(`已安装 ${data.skill.nameZh ?? data.skill.name}`, "success");
      } else {
        showToast("安装失败，请检查 URL", "error");
      }
    } catch {
      showToast("安装失败", "error");
    }
    setInstalling(false);
  };

  const handleLocalImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Partial<Skill>;
      const newSkill: Skill = {
        id: data.id ?? uid(),
        name: data.name ?? file.name,
        nameZh: data.nameZh ?? data.name ?? file.name,
        description: data.description ?? "",
        descriptionZh: data.descriptionZh ?? data.description ?? "",
        author: data.author ?? "本地导入",
        category: data.category ?? "custom",
        categoryZh: data.categoryZh ?? "自定义",
        installed: true,
        source: "local",
        localPath: file.name,
        content: data.content ?? text,
        capabilities: data.capabilities ?? [],
        useCases: data.useCases ?? [],
        installedAt: new Date().toISOString(),
      };
      setSkills((prev) => [...prev.filter((s) => s.id !== newSkill.id), newSkill]);
      await apiFetch("/api/skills", { method: "PUT", body: JSON.stringify([...skills, newSkill]) });
      showToast(`已导入 ${newSkill.nameZh}`, "success");
    } catch {
      showToast("导入失败，请检查文件格式", "error");
    }
    e.target.value = "";
  };

  const refreshStars = async () => {
    setRefreshing(true);
    try {
      const resp = await apiFetch("/api/skills/refresh-stars", { method: "POST" });
      if (resp.ok) {
        const data = (await resp.json()) as { skills: Skill[] };
        setSkills(data.skills);
        showToast("星标数已更新", "success");
      }
    } catch {}
    setRefreshing(false);
  };

  const installedCount = skills.filter((s) => s.installed).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            技能 <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}>({installedCount} 已安装)</span>
          </h2>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={refreshStars} disabled={refreshing} style={headerBtnStyle} title="刷新星标数">
              {refreshing ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={headerBtnStyle} title="本地导入">
              <Upload size={14} />
            </button>
            <button onClick={() => setShowGithubInstall(!showGithubInstall)} style={headerBtnStyle} title="GitHub 安装">
              <Globe size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 12px", borderRadius: 10,
          background: "var(--bg-secondary)", border: "1px solid var(--border)",
        }}>
          <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索技能..."
            style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category filter */}
        <div style={{ display: "flex", gap: 4, marginTop: 8, overflowX: "auto" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: "4px 12px", borderRadius: 10, border: "none", fontSize: 12,
                whiteSpace: "nowrap", cursor: "pointer",
                background: activeCategory === cat.id ? "var(--primary)" : "var(--bg-secondary)",
                color: activeCategory === cat.id ? "#fff" : "var(--text-secondary)",
                fontWeight: activeCategory === cat.id ? 600 : 400,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".json,.md,.txt" onChange={handleLocalImport} style={{ display: "none" }} />

      {/* GitHub install panel */}
      {showGithubInstall && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              style={{ flex: 1, ...inputStyle }}
            />
            <button onClick={handleGithubInstall} disabled={installing || !githubUrl.trim()} style={btnStyle("var(--primary)")}>
              {installing ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
            </button>
          </div>
        </div>
      )}

      {/* Skills list */}
      <div style={{ flex: 1, overflow: "auto", padding: "10px 16px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Package size={32} style={{ color: "var(--text-muted)", opacity: 0.5, marginBottom: 8 }} />
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {searchQuery ? "没有找到匹配的技能" : "暂无技能"}
            </div>
          </div>
        )}

        {filtered.map((skill) => (
          <div
            key={skill.id}
            style={{
              padding: 14, marginBottom: 8, borderRadius: 12,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              cursor: "pointer",
            }}
            onClick={() => setExpandedId(expandedId === skill.id ? null : skill.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}>
                  {skill.nameZh}
                  {skill.name !== skill.nameZh && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{skill.name}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {skill.author} · {skill.categoryZh}
                  {skill.source === "github" && (
                    <span style={{ marginLeft: 4, padding: "1px 4px", borderRadius: 3, background: "rgba(77,150,255,0.1)", color: "var(--primary)", fontSize: 10 }}>GitHub</span>
                  )}
                  {skill.source === "local" && (
                    <span style={{ marginLeft: 4, padding: "1px 4px", borderRadius: 3, background: "rgba(107,203,119,0.1)", color: "#6BCB77", fontSize: 10 }}>本地</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {skill.stars ? (
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    ⭐ {skill.stars > 1000 ? `${(skill.stars / 1000).toFixed(1)}k` : skill.stars}
                  </span>
                ) : null}
                {skill.repo && (
                  <a
                    href={skill.repo}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ padding: 4, color: "var(--text-muted)", display: "flex" }}
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
                {skill.source === "builtin" ? (
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(78,205,196,0.15)", color: "var(--primary)" }}>内置</span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); skill.installed ? uninstallSkill(skill.id) : installSkill(skill); }}
                    style={{
                      padding: 4, border: "none", background: "transparent",
                      color: skill.installed ? "var(--accent, #f43f5e)" : "var(--primary)",
                      cursor: "pointer", display: "flex",
                    }}
                  >
                    {skill.installed ? <Trash2 size={12} /> : <Download size={12} />}
                  </button>
                )}
              </div>
            </div>

            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0", lineHeight: 1.5 }}>
              {skill.descriptionZh}
            </p>

            {/* Capability tags */}
            {skill.capabilities && skill.capabilities.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {skill.capabilities.map((cap, i) => (
                  <span key={i} style={{
                    fontSize: 10, padding: "2px 6px", borderRadius: 4,
                    background: "var(--bg-secondary)", border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                  }}>{cap}</span>
                ))}
              </div>
            )}

            {/* Expanded use cases */}
            {expandedId === skill.id && skill.useCases && skill.useCases.length > 0 && (
              <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>💡 使用场景：</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {skill.useCases.map((uc, i) => (
                    <span key={i} style={{
                      fontSize: 11, padding: "2px 6px", borderRadius: 4,
                      background: "rgba(78,205,196,0.1)", color: "var(--primary)",
                    }}>{uc}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Installed badge */}
            {(skill.installed || skill.source === "builtin") && (
              <div style={{
                marginTop: 6, padding: "3px 8px", borderRadius: 4,
                background: "rgba(78,205,196,0.1)", color: "var(--primary)",
                fontSize: 11, display: "inline-block",
              }}>{skill.source === "builtin" ? "✓ 内置" : "✓ 已安装"}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const headerBtnStyle: React.CSSProperties = {
  padding: 6, borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg-card)", color: "var(--text-muted)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

const inputStyle: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg-secondary)",
  color: "var(--text-primary)", fontSize: 13, outline: "none",
};

const btnStyle = (bg: string): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 4,
  padding: "8px 14px", borderRadius: 8,
  border: "1px solid var(--border)", background: bg,
  color: bg.includes("primary") ? "#fff" : "var(--text-primary)",
  cursor: "pointer", fontSize: 12,
});
