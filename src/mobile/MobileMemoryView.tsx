import { useState, useEffect, useCallback } from "react";
import {
  Search, Trash2, Plus, Database, Brain, RefreshCw, Filter,
  Download, Upload, Zap, Link2, BarChart3, ChevronDown, ChevronRight,
  X,
} from "lucide-react";
import { apiFetch } from "../lib/shared";

interface MemoryItem {
  id: string;
  type: string;
  layer: string;
  content: string;
  confidence: number;
  source: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
  lastUsedAt?: string;
  confirmed: boolean;
  scope: string;
  retention: string;
  importance: number;
  tags: string[];
  version?: number;
  relatedIds?: string[];
  hitCount?: number;
}

interface MemoryStats {
  totalItems: number;
  l1Count: number;
  l2Count: number;
  l3Count: number;
  l4Count: number;
  recentAdditions: number;
  totalHits: number;
}

const LAYER_INFO: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  "L1-conversation": { label: "对话", color: "#3b82f6", icon: "💬", desc: "短期对话上下文" },
  "L2-working": { label: "工作", color: "#f59e0b", icon: "⚡", desc: "任务级记忆" },
  "L3-fact": { label: "事实", color: "#10b981", icon: "📌", desc: "长期事实知识" },
  "L4-episodic": { label: "情景", color: "#8b5cf6", icon: "📖", desc: "经验和情景" },
};

export function MobileMemoryView() {
  const [memories, setMemories] = useState<{ items: MemoryItem[]; l1: MemoryItem[]; l2: MemoryItem[] }>({ items: [], l1: [], l2: [] });
  const [stats, setStats] = useState<MemoryStats>({ totalItems: 0, l1Count: 0, l2Count: 0, l3Count: 0, l4Count: 0, recentAdditions: 0, totalHits: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryItem[] | null>(null);
  const [activeLayer, setActiveLayer] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState("fact");
  const [newTags, setNewTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [consolidationResult, setConsolidationResult] = useState<{ promoted: number; merged: number } | null>(null);

  const loadMemory = useCallback(async () => {
    try {
      const [memResp, statsResp] = await Promise.all([
        apiFetch("/api/memory"),
        apiFetch("/api/memory/stats"),
      ]);
      if (memResp.ok) {
        const data = (await memResp.json()) as { items?: MemoryItem[]; l1?: MemoryItem[]; l2?: MemoryItem[] };
        setMemories({
          items: Array.isArray(data.items) ? data.items : [],
          l1: Array.isArray(data.l1) ? data.l1 : [],
          l2: Array.isArray(data.l2) ? data.l2 : [],
        });
      }
      if (statsResp.ok) {
        setStats((await statsResp.json()) as MemoryStats);
      }
    } catch {}
  }, []);

  useEffect(() => { loadMemory(); }, [loadMemory]);
  useEffect(() => { const t = setInterval(loadMemory, 30000); return () => clearInterval(t); }, [loadMemory]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setLoading(true);
    try {
      const resp = await apiFetch("/api/memory/query", { method: "POST", body: JSON.stringify({ query: searchQuery, limit: 20 }) });
      if (resp.ok) setSearchResults((await resp.json()) as MemoryItem[]);
    } catch {} finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setLoading(true);
    try {
      const resp = await apiFetch("/api/memory/add", {
        method: "POST",
        body: JSON.stringify({
          content: newContent, type: newType,
          tags: newTags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (resp.ok) { setNewContent(""); setNewTags(""); setShowAddForm(false); loadMemory(); }
    } catch {} finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    try { await apiFetch(`/api/memory/${id}`, { method: "DELETE" }); loadMemory(); } catch {}
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    for (const id of selectedIds) {
      try { await apiFetch(`/api/memory/${id}`, { method: "DELETE" }); } catch {}
    }
    setSelectedIds(new Set());
    loadMemory();
  };

  const handleConsolidate = async () => {
    setLoading(true);
    try {
      const resp = await apiFetch("/api/memory/consolidate", { method: "POST" });
      if (resp.ok) {
        const data = (await resp.json()) as { promoted: number; merged: number };
        setConsolidationResult(data);
        loadMemory();
      }
    } catch {} finally { setLoading(false); }
  };

  const handleExport = async () => {
    try {
      const resp = await apiFetch("/api/memory/export", { method: "POST" });
      if (resp.ok) {
        const data = await resp.text();
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "flowith-memory.json"; a.click();
        URL.revokeObjectURL(url);
      }
    } catch {}
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await apiFetch("/api/memory/import", { method: "POST", body: text });
        loadMemory();
      } catch {}
    };
    input.click();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // Filter display list
  const displayList = searchResults ?? (activeLayer === "all" ? memories.items : memories.items.filter((m) => m.layer.startsWith(activeLayer)));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-primary)" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>记忆</h2>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={handleConsolidate} disabled={loading} style={headerBtnStyle} title="整合记忆">
              <Zap size={14} />
            </button>
            <button onClick={handleExport} style={headerBtnStyle} title="导出">
              <Download size={14} />
            </button>
            <button onClick={handleImport} style={headerBtnStyle} title="导入">
              <Upload size={14} />
            </button>
            <button onClick={() => setShowAddForm(!showAddForm)} style={{ ...headerBtnStyle, color: "var(--primary)" }} title="添加记忆">
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
          <StatMini label="L1" value={stats.l1Count} color="#3b82f6" />
          <StatMini label="L2" value={stats.l2Count} color="#f59e0b" />
          <StatMini label="L3" value={stats.l3Count} color="#10b981" />
          <StatMini label="L4" value={stats.l4Count} color="#8b5cf6" />
        </div>

        {/* Search */}
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 6,
            padding: "7px 10px", borderRadius: 10,
            background: "var(--bg-secondary)", border: "1px solid var(--border)",
          }}>
            <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="搜索记忆..."
              style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)" }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchResults(null); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}>
                <X size={14} />
              </button>
            )}
          </div>
          <button onClick={handleSearch} style={btnStyle("var(--bg-secondary)")}>搜索</button>
        </div>

        {/* Layer filter */}
        <div style={{ display: "flex", gap: 4, marginTop: 8, overflowX: "auto" }}>
          {[{ id: "all", label: "全部", color: "var(--text-secondary)" }, ...Object.entries(LAYER_INFO).map(([k, v]) => ({ id: k.split("-")[0], label: `${v.icon} ${v.label}`, color: v.color }))].map((tab) => (
            <button key={tab.id} onClick={() => { setActiveLayer(tab.id); setSearchResults(null); }} style={{
              padding: "3px 10px", borderRadius: 8, border: "none", fontSize: 11,
              whiteSpace: "nowrap", cursor: "pointer",
              background: activeLayer === tab.id ? tab.color : "var(--bg-secondary)",
              color: activeLayer === tab.id ? "#fff" : "var(--text-secondary)",
            }}>{tab.label}</button>
          ))}
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <textarea
            value={newContent} onChange={(e) => setNewContent(e.target.value)}
            placeholder="输入记忆内容..."
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", minHeight: 60 }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <select value={newType} onChange={(e) => setNewType(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", fontSize: 12 }}>
              <option value="fact">事实</option>
              <option value="preference">偏好</option>
              <option value="decision">决策</option>
              <option value="context">上下文</option>
            </select>
            <input
              value={newTags} onChange={(e) => setNewTags(e.target.value)}
              placeholder="标签 (逗号分隔)"
              style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-secondary)", fontSize: 12, outline: "none" }}
            />
            <button onClick={handleAdd} disabled={!newContent.trim()} style={btnStyle("var(--primary)")}>添加</button>
          </div>
        </div>
      )}

      {/* Batch actions */}
      {selectedIds.size > 0 && (
        <div style={{
          padding: "6px 16px", background: "rgba(244,63,94,0.05)",
          borderBottom: "1px solid var(--border)", display: "flex",
          justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>已选 {selectedIds.size} 条</span>
          <button onClick={handleBatchDelete} style={{ ...btnStyle("var(--accent, #f43f5e)"), padding: "4px 10px" }}>
            <Trash2 size={12} /> 批量删除
          </button>
        </div>
      )}

      {/* Consolidation result */}
      {consolidationResult && (
        <div style={{
          padding: "8px 16px", background: "rgba(16,185,129,0.05)",
          borderBottom: "1px solid var(--border)", fontSize: 12, color: "#10b981",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>整合完成：晋升 {consolidationResult.promoted} · 合并 {consolidationResult.merged}</span>
          <button onClick={() => setConsolidationResult(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Memory list */}
      <div style={{ flex: 1, overflow: "auto", padding: "10px 16px" }}>
        {displayList.length === 0 && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Brain size={32} style={{ color: "var(--text-muted)", opacity: 0.5, marginBottom: 8 }} />
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              {searchResults !== null ? "没有找到匹配的记忆" : "暂无记忆数据"}
            </div>
          </div>
        )}

        {displayList.map((item) => {
          const layerInfo = LAYER_INFO[item.layer] ?? { label: item.layer, color: "#6b7280", icon: "📝", desc: "" };
          const isSelected = selectedIds.has(item.id);
          return (
            <div key={item.id} style={{
              padding: "10px 12px", marginBottom: 6, borderRadius: 10,
              border: `1px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
              background: isSelected ? "rgba(14,165,233,0.03)" : "var(--bg-card)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  <button onClick={() => toggleSelect(item.id)} style={{
                    width: 16, height: 16, borderRadius: 4, border: "1px solid var(--border)",
                    background: isSelected ? "var(--primary)" : "transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {isSelected && <span style={{ color: "#fff", fontSize: 10 }}>✓</span>}
                  </button>
                  <span style={{ padding: "1px 6px", borderRadius: 4, background: layerInfo.color + "20", color: layerInfo.color, fontSize: 10, fontWeight: 600 }}>
                    {layerInfo.icon} {layerInfo.label}
                  </span>
                  <span style={{ padding: "1px 5px", borderRadius: 4, background: "var(--bg-secondary)", fontSize: 10, color: "var(--text-muted)" }}>{item.type}</span>
                  {(item.version ?? 1) > 1 && <span style={{ fontSize: 9, color: "var(--accent, #f43f5e)" }}>v{item.version}</span>}
                  {item.confirmed && <span style={{ fontSize: 9, color: "#10b981" }}>✓</span>}
                </div>
                <button onClick={() => handleDelete(item.id)} style={{
                  border: "none", background: "transparent", cursor: "pointer",
                  color: "var(--text-muted)", padding: 2, display: "flex",
                }}><Trash2 size={12} /></button>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-primary)" }}>{item.content}</div>
              {item.tags.length > 0 && (
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
                  {item.tags.map((tag, i) => (
                    <span key={i} style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "rgba(14,165,233,0.08)", color: "var(--primary)" }}>#{tag}</span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>
                <span>重要度 {Math.round(item.importance * 100)}%</span>
                <span>命中 {item.hitCount ?? 0}</span>
                <span>{new Date(item.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function StatMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: "6px 8px", borderRadius: 8,
      background: "var(--bg-secondary)", border: "1px solid var(--border)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const headerBtnStyle: React.CSSProperties = {
  padding: 6, borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg-card)", color: "var(--text-muted)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

const btnStyle = (bg: string): React.CSSProperties => ({
  display: "flex", alignItems: "center", gap: 3,
  padding: "6px 12px", borderRadius: 8,
  border: "1px solid var(--border)", background: bg,
  color: bg.includes("primary") || bg.includes("accent") ? "#fff" : "var(--text-primary)",
  cursor: "pointer", fontSize: 12,
});
