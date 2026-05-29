/**
 * Mobile Persistence Layer — IndexedDB
 *
 * Replaces server-side file I/O for mobile/Capacitor environments.
 * Uses the native IndexedDB API (no external dependencies).
 *
 * Stores: providers, conversations, agents, memory, skills, agent-models,
 *         agent-tts-configs, tts-providers
 */

const DB_NAME = "flowith";
const DB_VERSION = 1;

const STORES = [
  "providers",
  "conversations",
  "agents",
  "memory",
  "skills",
  "agent-models",
  "agent-tts-configs",
  "tts-providers",
  "metadata",
] as const;

type StoreName = (typeof STORES)[number];

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      }
    };

    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };

    req.onerror = () => reject(req.error);
  });
}

async function get<T>(store: StoreName, key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function put<T>(store: StoreName, key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function del(store: StoreName, key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function clear(store: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── High-level API matching server endpoints ─────────────────

export const mobileStorage = {
  // Providers
  async getProviders<T>(): Promise<T | null> { return get("providers", "list"); },
  async saveProviders<T>(data: T): Promise<void> { return put("providers", "list", data); },

  // Conversations
  async getConversations<T>(): Promise<T | null> { return get("conversations", "list"); },
  async saveConversations<T>(data: T): Promise<void> { return put("conversations", "list", data); },

  // Agents
  async getAgents<T>(): Promise<T | null> { return get("agents", "list"); },
  async saveAgents<T>(data: T): Promise<void> { return put("agents", "list", data); },

  // Memory
  async getMemory<T>(): Promise<T | null> { return get("memory", "store"); },
  async saveMemory<T>(data: T): Promise<void> { return put("memory", "store", data); },

  // Skills
  async getSkills<T>(): Promise<T | null> { return get("skills", "list"); },
  async saveSkills<T>(data: T): Promise<void> { return put("skills", "list", data); },

  // Agent model configs
  async getAgentModels<T>(): Promise<T | null> { return get("agent-models", "list"); },
  async saveAgentModels<T>(data: T): Promise<void> { return put("agent-models", "list", data); },

  // Agent TTS configs
  async getAgentTTSConfigs<T>(): Promise<T | null> { return get("agent-tts-configs", "list"); },
  async saveAgentTTSConfigs<T>(data: T): Promise<void> { return put("agent-tts-configs", "list", data); },

  // TTS Providers
  async getTTSProviders<T>(): Promise<T | null> { return get("tts-providers", "list"); },
  async saveTTSProviders<T>(data: T): Promise<void> { return put("tts-providers", "list", data); },

  // Generic
  get, put, del, getAll, clear,
};
