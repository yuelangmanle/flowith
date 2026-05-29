import { useState, useRef } from "react";
import {
  Download, ExternalLink, FileUp, Globe, Loader2, Package, RefreshCw,
  Search, Star, Trash2, Upload, X, ChevronDown, ChevronRight,
} from "lucide-react";
import { useStore } from "../lib/store";
import { apiFetch, uid } from "../lib/shared";
import type { Skill } from "../core/types";

const CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "installed", label: "已安装" },
  { id: "规划", label: "规划" },
  { id: "开发", label: "开发" },
  { id: "调试", label: "调试" },
  { id: "质量", label: "质量" },
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

  // Filter
  const filtered = skills.filter((s) => {
    if (activeCategory === "installed") return s.installed;
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
            {skill.installed && (
              <div style={{
                marginTop: 6, padding: "3px 8px", borderRadius: 4,
                background: "rgba(78,205,196,0.1)", color: "var(--primary)",
                fontSize: 11, display: "inline-block",
              }}>✓ 已安装</div>
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
