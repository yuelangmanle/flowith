import { FolderOpen } from "lucide-react";
import { projectTemplates } from "../core/demoData";

export function ProjectsView() {
  return (
    <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
      <h3 style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><FolderOpen size={16} /> 项目模板</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {projectTemplates.map((t) => (
          <div key={t.id} className="provider-card" style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <strong>{t.name}</strong>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{t.idea.slice(0, 100)}...</p>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--primary)" }}>{t.stack}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
