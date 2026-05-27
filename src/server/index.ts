import http from "node:http";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { runProjectGeneration } from "../core/agentOrchestrator";
import { createDefaultProviders, discoverModels } from "../core/modelGateway";
import { NodeWorkspaceRuntime } from "./workspaceRuntime.node";

const workspaceRoot = resolve(process.cwd(), ".agent-workspaces");
const runtime = new NodeWorkspaceRuntime(workspaceRoot);

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: http.ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  });
  response.end(JSON.stringify(body));
}

export async function createServer() {
  await mkdir(workspaceRoot, { recursive: true });
  return http.createServer(async (request, response) => {
    try {
      if (request.method === "OPTIONS") return send(response, 204, {});
      if (request.method === "GET" && request.url === "/api/health") {
        return send(response, 200, { ok: true, workspaceRoot });
      }
      if (request.method === "POST" && request.url === "/api/demo/run") {
        const run = await runProjectGeneration({
          idea: "Build an AI resume optimization web app.",
          stackOverride: "Vite + React + TypeScript",
          confirmPlan: true,
          approveDangerousActions: true
        });
        const workspace = await runtime.createWorkspace("ai-resume-optimizer");
        await Promise.all(Object.entries(run.files).map(([path, content]) => runtime.writeFile(workspace.id, path, content)));
        return send(response, 200, { run, workspace });
      }
      if (request.method === "POST" && request.url === "/api/providers/discover") {
        const input = await readJson(request) as { providerId?: string };
        const provider = createDefaultProviders().find((item) => item.id === input.providerId || item.type === input.providerId) ?? createDefaultProviders()[0];
        const models = await discoverModels(provider).catch(() => []);
        return send(response, 200, { provider, models });
      }
      return send(response, 404, { error: "not found" });
    } catch (error) {
      return send(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.AGENT_API_PORT ?? 8787);
  const server = await createServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Agent API listening on http://127.0.0.1:${port}`);
  });
}
