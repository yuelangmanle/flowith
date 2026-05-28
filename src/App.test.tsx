import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
vi.stubGlobal("fetch", mockFetch);

describe("App", () => {
  it("renders the multi-agent workspace shell", () => {
    render(<App />);
    expect(screen.getAllByText(/Multi-Agent Workspace/).length).toBeGreaterThan(0);
  });

  it("shows the status pills with agent count", () => {
    render(<App />);
    expect(screen.getByText(/11 Agents/)).toBeInTheDocument();
  });

  it("shows the new conversation button", () => {
    render(<App />);
    expect(screen.getByText("新对话")).toBeInTheDocument();
  });

  it("shows the navigation buttons", () => {
    render(<App />);
    expect(screen.getByText("对话")).toBeInTheDocument();
    expect(screen.getByText("圆桌会议")).toBeInTheDocument();
    expect(screen.getByText("代码生成")).toBeInTheDocument();
    expect(screen.getByText("项目模板")).toBeInTheDocument();
    expect(screen.getByText("设置")).toBeInTheDocument();
    expect(screen.getByText("Agent 管理")).toBeInTheDocument();
  });

  it("shows connection status indicator", () => {
    render(<App />);
    expect(screen.getByText(/(已连接|未连接)/)).toBeInTheDocument();
  });
});
