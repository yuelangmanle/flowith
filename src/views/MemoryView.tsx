import { useState, useEffect, useCallback } from "react";
import { Search, Trash2, Plus, Database, Brain, Zap, BookOpen, RefreshCw, Filter } from "lucide-react";
import { apiFetch } from "../lib/shared";

interface MemoryItem {
  id: string;
  type: string;
  layer: string;
  content: string;
  confidence: number;
  source: Record<string, unknown>;
  createdAt: string;
  lastUsedAt?: string;
  confirmed: boolean;
  scope: string;
  retention: string;
  importance: number;
  tags: string[];
}

interface MemoryStats {
  totalItems: number;
  l1Count: number;
  l2Count: number;
  l3Count: number;
  l4Count: number;
}

const LAYER_INFO: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  "L1-conversation": { label: "对话记忆", color: "#3b82f6", icon: "💬", desc: "短期对话上下文，自动过期" },
  "L2-working": { label: "工作记忆", color: "#f59e0b", icon: "⚡", desc: "任务级记忆，会话结束过期" },
  "L3-fact": { label: "事实记忆", color: "#10b981", icon: "📌", desc: "长期保存的事实知识" },
  "L4-episodic": { label: "情景记忆", color: "#8b5cf6", icon: "📖", desc: "长期保存的经验和情景" },
};

export function MemoryView() {
  const [memories, setMemories] = useState<{ items: MemoryItem[]; l1: MemoryItem[]; l2: MemoryItem[] }>({ items: [], l1: [], l2: [] });
  const [stats, setStats] = useState<MemoryStats>({ totalItems: 0, l1Count: 0, l2Count: 0, l3Count: 0, l4Count: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryItem[] | null>(null);
  const [activeLayer, setActiveLayer] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState("fact");
  const [newTags, setNewTags] = useState("");
  const [loading, setLoading] = useState(false);

  const loadMemory = useCallback(async () => {
    try {
      const resp = await apiFetch("/api/memory");
      if (resp.ok) {
        const data = await resp.json() as { items: MemoryItem[]; l1: MemoryItem[]; l2: MemoryItem[]; stats: MemoryStats };
        setMemories({ items: data.items ?? [], l1: data.l1 ?? [], l2: data.l2 ?? [] });
        setStats(data.stats ?? { totalItems: 0, l1Count: 0, l2Count: 0, l3Count: 0, l4Count: 0 });
      }
    } catch {}
  }, []);

  useEffect(() => { loadMemory(); }, [loadMemory]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setLoading(true);
    try {
      const resp = await apiFetch("/api/memory/query", {
        method: "POST",
        body: JSON.stringify({ query: searchQuery, limit: 20 }),
      });
      if (resp.ok) {
        const results = await resp.json() as MemoryItem[];
        setSearchResults(results);
      }
    } catch {} finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!newContent.trim()) return;
    setLoading(true);
    try {
      const resp = await apiFetch("/api/memory/add", {
        method: "POST",
        body: JSON.stringify({
          content: newContent,
          type: newType,
          tags: newTags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });
      if (resp.ok) {
        setNewContent("");
        setNewTags("");
        setShowAddForm(false);
        loadMemory();
      }
    } catch {} finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const resp = await apiFetch(`/api/memory/${id}`, { method: "DELETE" });
      if (resp.ok) loadMemory();
    } catch {}
  };

  const handleClearLayer = async (layer: string) => {
    if (!confirm(`确定要清除 ${LAYER_INFO[layer]?.label ?? layer} 的所有记忆吗？`)) return;
    try {
      await apiFetch(`/api/memory/clear?layer=${layer === "all" ? "all" : layer.split("-")[0]}`, { method: "DELETE" });
      loadMemory();
    } catch {}
  };

  const allMemories = [
    ...memories.l1.map(m => ({ ...m, layer: "L1-conversation" })),
    ...memories.l2.map(m => ({ ...m, layer: "L2-working" })),
    ...memories.items,
  ];

  const filteredMemories = (searchResults ?? allMemories).filter(m => {
    if (activeLayer === "all") return true;
    return m.layer === activeLayer;
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Database size={20} style={{ color: "var(--primary)" }} />
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>记忆系统</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowAddForm(!showAddForm)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--primary)", color: "white", cursor: "pointer", fontSize: 12 }}>
              <Plus size={14} /> 添加记忆
            </button>
            <button onClick={loadMemory} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", fontSize: 12 }}>
              <RefreshCw size={14} /> 刷新
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
          <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>总计</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{stats.totalItems}</div>
          </div>
          {Object.entries(LAYER_INFO).map(([key, info]) => (
            <div key={key} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)", cursor: "pointer", borderColor: activeLayer === key ? info.color : undefined }} onClick={() => setActiveLayer(activeLayer === key ? "all" : key)}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{info.icon} {info.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: info.color }}>{key === "L1-conversation" ? stats.l1Count : key === "L2-working" ? stats.l2Count : key === "L3-fact" ? stats.l3Count : stats.l4Count}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()} placeholder="搜索记忆内容..." style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <button onClick={handleSearch} disabled={loading} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--primary)", color: "white", cursor: "pointer", fontSize: 13 }}>
            {loading ? "搜索中..." : "搜索"}
          </button>
          {searchResults && <button onClick={() => { setSearchResults(null); setSearchQuery(""); }} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-card)", cursor: "pointer", fontSize: 13 }}>清除</button>}
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="输入记忆内容..." rows={3} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, outline: "none", resize: "vertical" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <select value={newType} onChange={e => setNewType(e.target.value)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12 }}>
                <option value="fact">事实</option>
                <option value="scenario">情景</option>
                <option value="persona">角色</option>
                <option value="project">项目</option>
              </select>
              <input value={newTags} onChange={e => setNewTags(e.target.value)} placeholder="标签（逗号分隔）" style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: 12, outline: "none" }} />
              <button onClick={handleAdd} disabled={loading || !newContent.trim()} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "white", cursor: "pointer", fontSize: 12 }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Layer Filter Tabs */}
      <div style={{ display: "flex", gap: 4, padding: "8px 24px", borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => setActiveLayer("all")} style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: activeLayer === "all" ? "var(--primary)" : "transparent", color: activeLayer === "all" ? "white" : "var(--text-secondary)", cursor: "pointer", fontSize: 11 }}>
          <Filter size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />全部
        </button>
        {Object.entries(LAYER_INFO).map(([key, info]) => (
          <button key={key} onClick={() => setActiveLayer(activeLayer === key ? "all" : key)} style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: activeLayer === key ? info.color : "transparent", color: activeLayer === key ? "white" : "var(--text-secondary)", cursor: "pointer", fontSize: 11 }}>
            {info.icon} {info.label}
          </button>
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
            {filteredMemories.map((item) => {
              const layerInfo = LAYER_INFO[item.layer] ?? { label: item.layer, color: "#6b7280", icon: "📝", desc: "" };
              return (
                <div key={item.id} style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ padding: "2px 6px", borderRadius: 4, background: layerInfo.color + "20", color: layerInfo.color, fontSize: 10, fontWeight: 600 }}>{layerInfo.icon} {layerInfo.label}</span>
                      <span style={{ padding: "2px 6px", borderRadius: 4, background: "var(--bg)", fontSize: 10, color: "var(--text-muted)" }}>{item.type}</span>
                      {item.tags.map((tag, i) => (
                        <span key={i} style={{ padding: "2px 6px", borderRadius: 4, background: "var(--primary)" + "15", color: "var(--primary)", fontSize: 10 }}>#{tag}</span>
                      ))}
                    </div>
                    <button onClick={() => handleDelete(item.id)} style={{ padding: "2px 6px", borderRadius: 4, border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }} title="删除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text)" }}>{item.content}</div>
                  <div style={{ display: "flex", gap: 12, marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                    <span>重要度: {(item.importance * 100).toFixed(0)}%</span>
                    <span>置信度: {(item.confidence * 100).toFixed(0)}%</span>
                    <span>范围: {item.scope === "global" ? "全局" : "项目"}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Layer Info Footer */}
      <div style={{ padding: "10px 24px", borderTop: "1px solid var(--border)", background: "var(--bg-card)", fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 16, justifyContent: "center" }}>
        {Object.entries(LAYER_INFO).map(([key, info]) => (
          <span key={key}>{info.icon} {info.label}: {info.desc}</span>
        ))}
      </div>
    </div>
  );
}
