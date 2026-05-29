import { useState, useEffect, useCallback } from "react";
import { Search, Trash2, Plus, Database, Brain, RefreshCw, Filter, Download, Upload, Zap, Link2, BarChart3 } from "lucide-react";
import { apiFetch } from "../lib/shared";
import { estimateTokens } from "../core/tokenCounter";

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
  sourceConversationId?: string;
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

interface ConsolidationResult {
  promoted: number;
  merged: number;
  evicted: number;
  keywordClusters: number;
}

const LAYER_INFO: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  "L1-conversation": { label: "对话记忆", color: "#3b82f6", icon: "💬", desc: "短期对话上下文，自动过期" },
  "L2-working": { label: "工作记忆", color: "#f59e0b", icon: "⚡", desc: "任务级记忆，会话结束过期" },
  "L3-fact": { label: "事实记忆", color: "#10b981", icon: "📌", desc: "长期保存的事实知识" },
  "L4-episodic": { label: "情景记忆", color: "#8b5cf6", icon: "📖", desc: "长期保存的经验和情景" },
};

export function MemoryView() {
  const [memories, setMemories] = useState<{ items: MemoryItem[]; l1: MemoryItem[]; l2: MemoryItem[] }>({ items: [], l1: [], l2: [] });
  const [stats, setStats] = useState<MemoryStats>({ totalItems: 0, l1Count: 0, l2Count: 0, l3Count: 0, l4Count: 0, recentAdditions: 0, totalHits: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryItem[] | null>(null);
  const [activeLayer, setActiveLayer] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState("fact");
  const [newTags, setNewTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [relatedItem, setRelatedItem] = useState<{ item: MemoryItem; related: MemoryItem[] } | null>(null);
  const [consolidationResult, setConsolidationResult] = useState<ConsolidationResult | null>(null);

  const loadMemory = useCallback(async () => {
    try {
      const [memResp, statsResp] = await Promise.all([
        apiFetch("/api/memory"),
        apiFetch("/api/memory/stats"),
      ]);
      if (memResp.ok) {
        const data = await memResp.json() as { items?: MemoryItem[]; l1?: MemoryItem[]; l2?: MemoryItem[]; stats?: MemoryStats };
        setMemories({
          items: Array.isArray(data.items) ? data.items : [],
          l1: Array.isArray(data.l1) ? data.l1 : [],
          l2: Array.isArray(data.l2) ? data.l2 : [],
        });
      }
      if (statsResp.ok) {
        setStats(await statsResp.json() as MemoryStats);
      }
    } catch {}
  }, []);

  useEffect(() => { loadMemory(); }, [loadMemory]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const timer = setInterval(loadMemory, 30000);
    return () => clearInterval(timer);
  }, [loadMemory]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setLoading(true);
    try {
      const resp = await apiFetch("/api/memory/query", { method: "POST", body: JSON.stringify({ query: searchQuery, limit: 20 }) });
      if (resp.ok) setSearchResults(await resp.json() as MemoryItem[]);
    } catch {} finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setLoading(true);
    try {
      const resp = await apiFetch("/api/memory/add", {
        method: "POST",
        body: JSON.stringify({ content: newContent, type: newType, tags: newTags.split(",").map(t => t.trim()).filter(Boolean) }),
      });
      if (resp.ok) { setNewContent(""); setNewTags(""); setShowAddForm(false); loadMemory(); }
    } catch {} finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    try { await apiFetch(`/api/memory/${id}`, { method: "DELETE" }); loadMemory(); } catch {}
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除 ${selectedIds.size} 条记忆吗？`)) return;
    for (const id of selectedIds) {
      try { await apiFetch(`/api/memory/${id}`, { method: "DELETE" }); } catch {}
    }
    setSelectedIds(new Set());
    loadMemory();
  };

  const handleClearLayer = async (layer: string) => {
    if (!confirm(`确定要清除 ${LAYER_INFO[layer]?.label ?? layer} 的所有记忆吗？`)) return;
    try {
      await apiFetch(`/api/memory/clear?layer=${layer === "all" ? "all" : layer.split("-")[0]}`, { method: "DELETE" });
      loadMemory();
    } catch {}
  };

  const handleConsolidate = async () => {
    setLoading(true);
    try {
      const resp = await apiFetch("/api/memory/consolidate", { method: "POST" });
      if (resp.ok) {
        const result = await resp.json() as ConsolidationResult;
        setConsolidationResult(result);
        loadMemory();
      }
    } catch {} finally { setLoading(false); }
  };

  const handleExport = async () => {
    try {
      const resp = await apiFetch("/api/memory/export", { method: "POST" });
      if (resp.ok) {
        const data = await resp.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `flowith-memory-${new Date().toISOString().slice(0, 10)}.json`; a.click();
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
        const data = JSON.parse(text);
        const resp = await apiFetch("/api/memory/import", { method: "POST", body: JSON.stringify(data) });
        if (resp.ok) loadMemory();
      } catch {}
    };
    input.click();
  };

  const handleShowRelations = async (id: string) => {
    try {
      const resp = await apiFetch(`/api/memory/relations/${id}`);
      if (resp.ok) setRelatedItem(await resp.json() as { item: MemoryItem; related: MemoryItem[] });
    } catch {}
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allMemories = [
    ...(memories.l1 ?? []).map(m => ({ ...m, layer: "L1-conversation" })),
    ...(memories.l2 ?? []).map(m => ({ ...m, layer: "L2-working" })),
    ...(memories.items ?? []),
  ];

  const filteredMemories = (searchResults ?? allMemories).filter(m => {
    if (activeLayer === "all") return true;
    return m.layer === activeLayer;
  });

  const totalTokens = allMemories.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Database size={20} style={{ color: "var(--primary)" }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>记忆系统</h2>
            <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg)", padding: "2px 8px", borderRadius: 4 }}>~{totalTokens.toLocaleString()} tokens</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleConsolidate} disabled={loading} style={btnStyle("var(--accent)")}>
              <Zap size={14} /> 整合
            </button>
            <button onClick={handleExport} style={btnStyle("var(--bg-card)")}>
              <Download size={14} /> 导出
            </button>
            <button onClick={handleImport} style={btnStyle("var(--bg-card)")}>
              <Upload size={14} /> 导入
            </button>
            <button onClick={() => setShowAddForm(!showAddForm)} style={btnStyle("var(--primary)")}>
              <Plus size={14} /> 添加
            </button>
            <button onClick={loadMemory} style={btnStyle("var(--bg-card)")}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 16 }}>
          <StatCard label="总计" value={stats.totalItems} color="var(--text)" />
          <StatCard label="近期新增" value={stats.recentAdditions} color="var(--primary)" />
          <StatCard label="命中次数" value={stats.totalHits} color="var(--accent)" />
          {Object.entries(LAYER_INFO).map(([key, info]) => (
            <div key={key} style={{ ...statCardStyle, cursor: "pointer", borderColor: activeLayer === key ? info.color : "var(--border)" }} onClick={() => setActiveLayer(activeLayer === key ? "all" : key)}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{info.icon} {info.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: info.color }}>
                {key === "L1-conversation" ? stats.l1Count : key === "L2-working" ? stats.l2Count : key === "L3-fact" ? stats.l3Count : stats.l4Count}
              </div>
            </div>
          ))}
        </div>

        {/* Consolidation Result */}
        {consolidationResult && (
          <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--primary)" + "15", border: "1px solid var(--primary)" + "30", marginBottom: 12, fontSize: 12, display: "flex", gap: 16, alignItems: "center" }}>
            <Zap size={14} style={{ color: "var(--primary)" }} />
            <span>整合完成: 晋升 <strong>{consolidationResult.promoted}</strong> 条</span>
            <span>合并 <strong>{consolidationResult.merged}</strong> 条</span>
            <span>清理 <strong>{consolidationResult.evicted}</strong> 条</span>
            <button onClick={() => setConsolidationResult(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
          </div>
        )}

        {/* Search + Batch */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} placeholder="搜索记忆内容..." style={inputStyle} />
          </div>
          <button onClick={handleSearch} disabled={loading} style={btnStyle("var(--primary)")}>{loading ? "..." : "搜索"}</button>
          {searchResults && <button onClick={() => { setSearchResults(null); setSearchQuery(""); }} style={btnStyle("var(--bg-card)")}>清除</button>}
          {selectedIds.size > 0 && <button onClick={handleBatchDelete} style={btnStyle("#ef4444")}>删除 {selectedIds.size} 条</button>}
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="输入记忆内容..." rows={3} style={{ ...inputStyle, resize: "vertical" } as React.CSSProperties} />
            <div style={{ display: "flex", gap: 8 }}>
              <select value={newType} onChange={e => setNewType(e.target.value)} style={{ ...inputStyle, width: 120 }}>
                <option value="fact">事实</option><option value="scenario">情景</option><option value="persona">角色</option><option value="project">项目</option>
              </select>
              <input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="标签（逗号分隔）" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={handleAdd} disabled={loading || !newContent.trim()} style={btnStyle("var(--primary)")}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Layer Filter Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "8px 24px", borderBottom: "1px solid var(--border)" }}>
        <FilterTab label="全部" active={activeLayer === "all"} color="var(--primary)" onClick={() => setActiveLayer("all")} />
        {Object.entries(LAYER_INFO).map(([key, info]) => (
          <FilterTab key={key} label={`${info.icon} ${info.label}`} active={activeLayer === key} color={info.color} onClick={() => setActiveLayer(activeLayer === key ? "all" : key)} />
        ))}
      </div>

      {/* Memory List */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 24px" }}>
        {filteredMemories.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            <Brain size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
            <div>暂无记忆数据</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>与 AI 对话时会自动积累记忆</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredMemories.map((item) => (
              <MemoryCard
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                onToggleSelect={() => toggleSelect(item.id)}
                onDelete={() => handleDelete(item.id)}
                onShowRelations={() => handleShowRelations(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Related Items Modal */}
      {relatedItem && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setRelatedItem(null)}>
          <div style={{ background: "var(--bg-card)", borderRadius: 12, padding: 24, maxWidth: 600, width: "90%", maxHeight: "70vh", overflow: "auto" }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>关联记忆</h3>
            <div style={{ padding: "10px", borderRadius: 8, background: "var(--bg)", marginBottom: 12, fontSize: 13 }}>{relatedItem.item.content}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>关联 {relatedItem.related.length} 条记忆:</div>
            {relatedItem.related.map(r => (
              <div key={r.id} style={{ padding: "8px 10px", borderRadius: 6, background: "var(--bg)", marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: LAYER_INFO[r.layer]?.color ?? "#666" }}>{LAYER_INFO[r.layer]?.icon ?? "📝"}</span> {r.content.slice(0, 100)}
              </div>
            ))}
            <button onClick={() => setRelatedItem(null)} style={{ ...btnStyle("var(--bg-card)", true), marginTop: 12 }}>关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={statCardStyle}>
      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function FilterTab({ label, active, color, onClick }: { label: string; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: active ? color : "transparent", color: active ? "white" : "var(--text-secondary)", cursor: "pointer", fontSize: 11, fontWeight: active ? 600 : 400 }}>
      {label}
    </button>
  );
}

function MemoryCard({ item, selected, onToggleSelect, onDelete, onShowRelations }: { item: MemoryItem; selected: boolean; onToggleSelect: () => void; onDelete: () => void; onShowRelations: () => void }) {
  const layerInfo = LAYER_INFO[item.layer] ?? { label: item.layer, color: "#6b7280", icon: "📝", desc: "" };
  return (
    <div style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`, background: selected ? "var(--primary)" + "08" : "var(--bg-card)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <input type="checkbox" checked={selected} onChange={onToggleSelect} style={{ cursor: "pointer" }} />
          <span style={{ padding: "2px 6px", borderRadius: 4, background: layerInfo.color + "20", color: layerInfo.color, fontSize: 10, fontWeight: 600 }}>{layerInfo.icon} {layerInfo.label}</span>
          <span style={{ padding: "2px 6px", borderRadius: 4, background: "var(--bg)", fontSize: 10, color: "var(--text-muted)" }}>{item.type}</span>
          {(item.version ?? 1) > 1 && <span style={{ padding: "2px 4px", borderRadius: 4, background: "var(--accent)" + "20", color: "var(--accent)", fontSize: 9 }}>v{item.version}</span>}
          {item.confirmed && <span style={{ padding: "2px 4px", borderRadius: 4, background: "#10b98120", color: "#10b981", fontSize: 9 }}>✓ 已确认</span>}
          {item.tags.map((tag, i) => <span key={i} style={{ padding: "2px 6px", borderRadius: 4, background: "var(--primary)" + "15", color: "var(--primary)", fontSize: 10 }}>#{tag}</span>)}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(item.relatedIds?.length ?? 0) > 0 && (
            <button onClick={onShowRelations} style={iconBtnStyle} title={`查看 ${item.relatedIds!.length} 条关联记忆`}>
              <Link2 size={13} /> <span style={{ fontSize: 10 }}>{item.relatedIds!.length}</span>
            </button>
          )}
          <button onClick={onDelete} style={iconBtnStyle} title="删除"><Trash2 size={13} /></button>
        </div>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>{item.content}</div>
      <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
        <span>重要度: {Math.round(item.importance * 100)}%</span>
        <span>置信度: {Math.round(item.confidence * 100)}%</span>
        <span>命中: {item.hitCount ?? 0}</span>
        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
        {item.updatedAt && <span>更新: {new Date(item.updatedAt).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const statCardStyle: React.CSSProperties = { padding: "10px 12px", borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)" };
const inputStyle: React.CSSProperties = { padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, outline: "none" };
const iconBtnStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 2, padding: "2px 6px", borderRadius: 4, border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 11 };

function btnStyle(bg: string, fullWidth?: boolean): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: bg, color: bg === "var(--bg-card)" ? "var(--text)" : "white", cursor: "pointer", fontSize: 12, width: fullWidth ? "100%" : undefined, justifyContent: "center" as const };
}
