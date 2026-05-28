import { describe, expect, it, beforeEach } from "vitest";
import {
  saveProviders,
  loadProviders,
  saveConversation,
  loadConversations,
  deleteConversation,
  loadConversation,
} from "../persistence";
import type { Conversation, ProviderConfig } from "../types";

// Mock localStorage
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (index: number) => Array.from(store.keys())[index] ?? null,
};

Object.defineProperty(globalThis, "localStorage", { value: mockLocalStorage });

beforeEach(() => {
  store.clear();
});

describe("persistence", () => {
  const mockProvider: ProviderConfig = {
    id: "openai",
    type: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    enabled: true,
    supportsModelList: true,
  };

  const mockConversation: Conversation = {
    id: "conv-1",
    title: "Test",
    type: "chat",
    agentIds: ["agent-developer"],
    messages: [
      {
        id: "msg-1",
        role: "user",
        content: "Hello",
        createdAt: new Date().toISOString(),
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("saves and loads providers", () => {
    expect(loadProviders()).toBeNull();
    saveProviders([mockProvider]);
    const loaded = loadProviders();
    expect(loaded).toHaveLength(1);
    expect(loaded![0].id).toBe("openai");
    expect(loaded![0].apiKey).toBe("sk-test");
  });

  it("saves and loads conversations", () => {
    expect(loadConversations()).toHaveLength(0);
    saveConversation(mockConversation);
    const loaded = loadConversations();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("conv-1");
    expect(loaded[0].messages).toHaveLength(1);
  });

  it("updates existing conversation on save", () => {
    saveConversation(mockConversation);
    const updated = { ...mockConversation, title: "Updated", messages: [...mockConversation.messages, { id: "msg-2", role: "assistant" as const, content: "Hi", createdAt: new Date().toISOString() }] };
    saveConversation(updated);
    const loaded = loadConversations();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe("Updated");
    expect(loaded[0].messages).toHaveLength(2);
  });

  it("deletes conversation", () => {
    saveConversation(mockConversation);
    saveConversation({ ...mockConversation, id: "conv-2", title: "Other" });
    expect(loadConversations()).toHaveLength(2);
    deleteConversation("conv-1");
    expect(loadConversations()).toHaveLength(1);
    expect(loadConversations()[0].id).toBe("conv-2");
  });

  it("loads single conversation by id", () => {
    saveConversation(mockConversation);
    expect(loadConversation("conv-1")).toBeTruthy();
    expect(loadConversation("nonexistent")).toBeNull();
  });

  it("handles corrupted localStorage gracefully", () => {
    store.set("maw-providers", "not-json");
    expect(loadProviders()).toBeNull();
    expect(loadConversations()).toHaveLength(0);
  });
});
