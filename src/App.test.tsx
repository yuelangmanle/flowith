import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  it("runs project generation from the workspace button", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      run: {
        id: "run-ai-resume",
        status: "completed",
        logs: ["产品 Agent 完成需求澄清。"],
        files: { "README.md": "# AI Resume Optimizer" },
        preview: { status: "ready", url: "http://localhost:5173" }
      },
      workspace: { path: "/tmp/agent/ai-resume-optimizer" }
    })));
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /生成项目原型/ }));
    await waitFor(() => expect(screen.getByText(/工作区：\/tmp\/agent\/ai-resume-optimizer/)).toBeInTheDocument());
    expect(screen.getByText(/ready: http:\/\/localhost:5173/)).toBeInTheDocument();
  });
});
