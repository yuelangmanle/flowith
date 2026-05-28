import type { Conversation, ProviderConfig, Project } from "./types";

const STORAGE_PREFIX = "maw-";
const PROVIDERS_KEY = STORAGE_PREFIX + "providers";
const CONVERSATIONS_KEY = STORAGE_PREFIX + "conversations";
const PROJECTS_KEY = STORAGE_PREFIX + "projects";

function safeGet<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // silently ignore storage errors
  }
}

// ─── Providers ──────────────────────────────────────────────────

const PROVIDERS_VERSION = 2; // Bump when adding new default providers

export function loadProviders(): ProviderConfig[] | null {
  const saved = safeGet<ProviderConfig[] | null>(PROVIDERS_KEY, null);
  if (!saved) return null;
  // Check if saved providers are outdated (missing new defaults)
  const version = safeGet<number>(PROVIDERS_KEY + "-version", 0);
  if (version < PROVIDERS_VERSION) {
    // Clear stale cache so store merges with fresh defaults
    return null;
  }
  return saved;
}

export function saveProviders(providers: ProviderConfig[]): void {
  safeSet(PROVIDERS_KEY, providers);
  safeSet(PROVIDERS_KEY + "-version", PROVIDERS_VERSION);
}



// ─── Conversations ──────────────────────────────────────────────

export function loadConversations(): Conversation[] {
  return safeGet<Conversation[]>(CONVERSATIONS_KEY, []);
}

export function saveConversation(conversation: Conversation): void {
  const all = loadConversations();
  const index = all.findIndex((c) => c.id === conversation.id);
  if (index >= 0) all[index] = conversation;
  else all.unshift(conversation);
  safeSet(CONVERSATIONS_KEY, all.slice(0, 200));
}

export function deleteConversation(id: string): void {
  const all = loadConversations().filter((c) => c.id !== id);
  safeSet(CONVERSATIONS_KEY, all);
}

export function loadConversation(id: string): Conversation | null {
  return loadConversations().find((c) => c.id === id) ?? null;
}

// ─── Projects ───────────────────────────────────────────────────

export function loadProjects(): Project[] {
  return safeGet<Project[]>(PROJECTS_KEY, []);
}

export function saveProject(project: Project): void {
  const all = loadProjects();
  const index = all.findIndex((p) => p.id === project.id);
  if (index >= 0) all[index] = project;
  else all.unshift(project);
  safeSet(PROJECTS_KEY, all.slice(0, 50));
}

export function deleteProject(id: string): void {
  const all = loadProjects().filter((p) => p.id !== id);
  safeSet(PROJECTS_KEY, all);
}
