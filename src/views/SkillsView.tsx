import { useState, useEffect } from "react";
import { Download, ExternalLink, Loader2, Package, Search, Star, Trash2 } from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch } from "../lib/shared";

interface Skill {
  id: string;
  name: string;
  description: string;
  author: string;
  repo?: string;      // GitHub repo URL
  installed?: boolean;
  category: string;
  stars?: number;
}

// Built-in curated skills from popular open-source projects
const BUILT_IN_SKILLS: Skill[] = [
  // Superpowers / Obra
  { id: "brainstorming", name: "Brainstorming", description: "Structured brainstorming before creative work", author: "Obra", repo: "https://github.com/obra/superpowers", category: "Planning", stars: 2800 },
  { id: "tdd", name: "Test-Driven Development", description: "Write tests before implementation", author: "Obra", repo: "https://github.com/obra/superpowers", category: "Development", stars: 2800 },
  { id: "systematic-debugging", name: "Systematic Debugging", description: "Root cause investigation before fixes", author: "Obra", repo: "https://github.com/obra/superpowers", category: "Debugging", stars: 2800 },
  { id: "code-review", name: "Code Review", description: "Request and receive structured code reviews", author: "Obra", repo: "https://github.com/obra/superpowers", category: "Quality", stars: 2800 },
  { id: "writing-plans", name: "Writing Plans", description: "Create implementation plans from specs", author: "Obra", repo: "https://github.com/obra/superpowers", category: "Planning", stars: 2800 },

  // CrewAI
  { id: "crewai-agents", name: "CrewAI Agents", description: "Multi-agent orchestration framework", author: "CrewAI", repo: "https://github.com/crewAIInc/crewAI", category: "Framework", stars: 25000 },
  { id: "crewai-tools", name: "CrewAI Tools", description: "Pre-built tools for CrewAI agents", author: "CrewAI", repo: "https://github.com/crewAIInc/crewAI", category: "Tools", stars: 25000 },

  // Langchain / LangGraph
  { id: "langchain-rag", name: "LangChain RAG", description: "Retrieval-augmented generation pipeline", author: "LangChain", repo: "https://github.com/langchain-ai/langchain", category: "RAG", stars: 98000 },
  { id: "langgraph-workflow", name: "LangGraph Workflow", description: "Stateful multi-actor workflows", author: "LangChain", repo: "https://github.com/langchain-ai/langgraph", category: "Workflow", stars: 8000 },

  // Dify
  { id: "dify-workflow", name: "Dify Workflow", description: "Visual LLM workflow builder", author: "Dify", repo: "https://github.com/langgenius/dify", category: "Workflow", stars: 55000 },
  { id: "dify-rag", name: "Dify RAG Pipeline", description: "Document indexing and retrieval", author: "Dify", repo: "https://github.com/langgenius/dify", category: "RAG", stars: 55000 },

  // OpenBMB / ChatDev
  { id: "chatdev", name: "ChatDev", description: "Multi-agent software development simulation", author: "OpenBMB", repo: "https://github.com/openbmb/ChatDev", category: "Development", stars: 25000 },

  // Browser / Web
  { id: "browser-use", name: "Browser Use", description: "AI-powered browser automation", author: "Browser Use", repo: "https://github.com/browser-use/browser-use", category: "Automation", stars: 15000 },
  { id: "web-scraper", name: "Web Scraper", description: "Intelligent web content extraction", author: "Community", repo: "https://github.com/unclecode/crawl4ai", category: "Data", stars: 12000 },

  // Memory / Knowledge
  { id: "mem0", name: "Mem0 Memory", description: "Long-term memory for AI agents", author: "Mem0", repo: "https://github.com/mem0ai/mem0", category: "Memory", stars: 8000 },
  { id: "rag-knowledge", name: "RAG Knowledge Base", description: "Document-based knowledge retrieval", author: "Community", repo: "https://github.com/run-llama/llama_index", category: "Knowledge", stars: 35000 },

  // Code Generation
  { id: "aider", name: "Aider", description: "AI pair programming in terminal", author: "Aider", repo: "https://github.com/paul-gauthier/aider", category: "Coding", stars: 28000 },
  { id: "swe-agent", name: "SWE-Agent", description: "Autonomous software engineering agent", author: "Princeton NLP", repo: "https://github.com/princeton-nlp/SWE-agent", category: "Coding", stars: 12000 },

  // Data Analysis
  { id: "pandas-agent", name: "Pandas AI Agent", description: "Natural language data analysis", author: "Community", repo: "https://github.com/Sinaptik-AI/pandas-ai", category: "Data", stars: 12000 },
];

const CATEGORIES = [...new Set(BUILT_IN_SKILLS.map((s) => s.category))];

export function SkillsView() {
  const { showToast } = useStore();
  const [skills, setSkills] = useState<Skill[]>(BUILT_IN_SKILLS);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [githubUrl, setGithubUrl] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

  // Load installed skills from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("agent-installed-skills");
      if (saved) setInstalledIds(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  const filtered = skills.filter((s) => {
    if (category !== "all" && s.category !== category) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const installFromGithub = async () => {
    if (!githubUrl.trim()) return;
    setInstalling(true);
    try {
      // Parse GitHub URL
      const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) { showToast("无效的 GitHub URL", "error"); return; }
      const [, owner, repo] = match;
      const repoName = repo.replace(/\.git$/, "");

      // Add to skills list
      const newSkill: Skill = {
        id: `${owner}-${repoName}`,
        name: repoName,
        description: `来自 ${owner}/${repoName}`,
        author: owner,
        repo: githubUrl,
        category: "Custom",
      };

      if (!skills.find((s) => s.id === newSkill.id)) {
        setSkills((prev) => [newSkill, ...prev]);
      }

      // Mark as installed
      const newInstalled = new Set(installedIds);
      newInstalled.add(newSkill.id);
      setInstalledIds(newInstalled);
      localStorage.setItem("agent-installed-skills", JSON.stringify([...newInstalled]));

      showToast(`已安装 ${repoName}`, "success");
      setGithubUrl("");
    } catch {
      showToast("安装失败", "error");
    }
    setInstalling(false);
  };

  const toggleInstall = (id: string) => {
    const newInstalled = new Set(installedIds);
    if (newInstalled.has(id)) {
      newInstalled.delete(id);
    } else {
      newInstalled.add(id);
    }
    setInstalledIds(newInstalled);
    localStorage.setItem("agent-installed-skills", JSON.stringify([...newInstalled]));
  };

  return (
    <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
      <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><Package size={18} /> Skills 市场</h3>

      {/* Install from GitHub */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input placeholder="输入 GitHub URL 安装 Skill..." value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text)" }} onKeyDown={(e) => { if (e.key === "Enter") installFromGithub(); }} />
        <button className="primary" onClick={installFromGithub} disabled={installing || !githubUrl.trim()}>
          {installing ? <Loader2 size={14} className="spin" /> : <Download size={14} />} 安装
        </button>
      </div>

      {/* Search + Category filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <Search size={14} style={{ color: "var(--text-muted)" }} />
          <input placeholder="搜索 Skills..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ border: "none", background: "transparent", flex: 1, fontSize: 13, color: "var(--text)" }} />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 13 }}>
          <option value="all">全部</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Skills grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {filtered.map((skill) => (
          <div key={skill.id} className="provider-card" style={{ padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{skill.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>by {skill.author} · {skill.category}</div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {skill.repo && (
                  <a href={skill.repo} target="_blank" rel="noopener noreferrer" className="icon-btn" style={{ padding: 4 }} title="查看源码">
                    <ExternalLink size={12} />
                  </a>
                )}
                <button className={`icon-btn ${installedIds.has(skill.id) ? "tts-active" : ""}`} onClick={() => toggleInstall(skill.id)} title={installedIds.has(skill.id) ? "卸载" : "安装"} style={{ padding: 4, color: installedIds.has(skill.id) ? "var(--primary)" : "var(--text-muted)" }}>
                  {installedIds.has(skill.id) ? <Trash2 size={12} /> : <Download size={12} />}
                </button>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>{skill.description}</p>
            {skill.stars && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                <Star size={10} /> {skill.stars > 1000 ? `${(skill.stars / 1000).toFixed(1)}k` : skill.stars}
              </div>
            )}
            {installedIds.has(skill.id) && (
              <div style={{ marginTop: 6, padding: "3px 8px", borderRadius: 4, background: "rgba(78,205,196,0.1)", color: "var(--primary)", fontSize: 11, display: "inline-block" }}>✓ 已安装</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
