import { useState, useEffect } from "react";
import { Download, ExternalLink, RefreshCw, X } from "lucide-react";
import { checkForUpdate, getDownloadAsset, type UpdateInfo } from "../lib/updater";

interface Props {
  currentVersion: string;
  platform: "mac" | "win" | "android";
  /** Auto-check on mount. Default true */
  autoCheck?: boolean;
  /** Show as inline banner or compact button */
  mode?: "banner" | "compact";
}

const PLATFORM_LABELS = { mac: "macOS", win: "Windows", android: "Android" };

export function UpdateChecker({ currentVersion, platform, autoCheck = true, mode = "banner" }: Props) {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (autoCheck) doCheck();
  }, []);

  const doCheck = async () => {
    setChecking(true);
    const info = await checkForUpdate(currentVersion);
    setUpdate(info);
    setChecking(false);
    setDismissed(false);
  };

  if (dismissed || !update) {
    if (mode === "compact") {
      return (
        <button onClick={doCheck} disabled={checking} style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)",
          background: "var(--bg-card)", color: "var(--text-muted)",
          cursor: "pointer", fontSize: 12,
        }}>
          <RefreshCw size={12} className={checking ? "spin" : ""} />
          {checking ? "检查中..." : "检查更新"}
        </button>
      );
    }
    return null;
  }

  const asset = getDownloadAsset(update, platform);

  if (mode === "compact") {
    return (
      <button onClick={() => asset && (window.open(asset.url, "_blank"))} style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "4px 10px", borderRadius: 8, border: "1px solid var(--primary)",
        background: "rgba(14,165,233,0.08)", color: "var(--primary)",
        cursor: "pointer", fontSize: 12, fontWeight: 600,
      }}>
        <Download size={12} /> 更新 {update.version}
      </button>
    );
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 14px", borderRadius: 10,
      background: "linear-gradient(135deg, rgba(14,165,233,0.08), rgba(139,92,246,0.08))",
      border: "1px solid rgba(14,165,233,0.2)",
      marginBottom: 8,
    }}>
      <Download size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
          新版本 {update.version} 可用
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {PLATFORM_LABELS[platform]} · {new Date(update.publishedAt).toLocaleDateString()}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {asset && (
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 3,
              padding: "5px 10px", borderRadius: 6,
              background: "var(--primary)", color: "#fff",
              fontSize: 11, fontWeight: 600, textDecoration: "none",
            }}
          >
            <Download size={12} /> 下载
          </a>
        )}
        <a
          href={update.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex", alignItems: "center", gap: 3,
            padding: "5px 8px", borderRadius: 6,
            border: "1px solid var(--border)", background: "var(--bg-card)",
            color: "var(--text-secondary)", fontSize: 11, textDecoration: "none",
          }}
        >
          <ExternalLink size={12} />
        </a>
        <button onClick={() => setDismissed(true)} style={{
          padding: 5, border: "none", background: "transparent",
          color: "var(--text-muted)", cursor: "pointer", display: "flex",
        }}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
