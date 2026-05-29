// ─── Shared utilities used across all views ────────────────────

export const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? `http://${window.location.hostname}:8787`
    : `http://127.0.0.1:8787`;

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
}

export function getProviderIcon(type: string): string {
  // Returns a short label used as fallback; prefer getProviderIconComponent for rendering
  const icons: Record<string, string> = {
    openai: "AI", anthropic: "CL", gemini: "GM", deepseek: "DS",
    qwen: "QN", moonshot: "MS", ollama: "OL", "openai-compatible": "AI",
    "xiaomi-mimo": "MI",
  };
  return icons[type] ?? "AI";
}
