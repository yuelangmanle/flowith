/**
 * API Adapter Layer
 *
 * Abstracts how the frontend communicates with the backend:
 * - Desktop/Web: HTTP calls to Node.js sidecar on port 8787
 * - Mobile (Capacitor): Direct calls to TypeScript business logic
 *
 * The adapter is selected automatically based on the runtime environment.
 */

export interface ApiAdapter {
  fetch(path: string, init?: RequestInit): Promise<Response>;
  isMobile(): boolean;
}

// ─── Desktop/Web Adapter: HTTP to Node.js sidecar ──────────────

function resolveApiBase(): string {
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") {
    return `http://${h}:8787`;
  }
  return "http://127.0.0.1:8787";
}

class HttpApiAdapter implements ApiAdapter {
  private baseUrl: string;
  constructor(baseUrl?: string) { this.baseUrl = baseUrl ?? resolveApiBase(); }

  async fetch(path: string, init?: RequestInit): Promise<Response> {
    return window.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  }

  isMobile(): boolean { return false; }
}

// ─── Mobile Adapter: Direct TypeScript function calls ──────────

type RouteHandler = (path: string, method: string, body: unknown) => Promise<unknown>;
type StreamRouteHandler = (path: string, body: unknown) => AsyncGenerator<{ type: string; data: unknown }>;

class DirectApiAdapter implements ApiAdapter {
  private routeHandler: RouteHandler | null = null;
  private streamRouteHandler: StreamRouteHandler | null = null;

  setRouteHandler(handler: RouteHandler) { this.routeHandler = handler; }
  setStreamRouteHandler(handler: StreamRouteHandler) { this.streamRouteHandler = handler; }

  async fetch(path: string, init?: RequestInit): Promise<Response> {
    const method = init?.method ?? "GET";
    let body: unknown = undefined;

    if (init?.body && typeof init.body === "string") {
      try { body = JSON.parse(init.body); } catch { body = init.body; }
    }

    // Streaming endpoints: return SSE ReadableStream response
    const streamingPaths = ["/api/chat", "/api/roundtable", "/api/orchestrate/sequential", "/api/orchestrate/hierarchical", "/api/codegen"];
    if (streamingPaths.includes(path) && this.streamRouteHandler) {
      try {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start: async (controller) => {
            try {
              for await (const event of this.streamRouteHandler!(path, body)) {
                try {
                  const sseData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
                  controller.enqueue(encoder.encode(sseData));
                } catch (encodeErr) {
                  console.error("[Mobile] SSE encode error:", encodeErr);
                }
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("[Mobile] Stream handler error:", msg);
              try {
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`));
              } catch {}
            }
            try { controller.close(); } catch {}
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
        });
      } catch (streamErr) {
        // Fallback: if ReadableStream fails, collect all events into a single response
        console.warn("[Mobile] ReadableStream failed, using fallback:", streamErr);
        const events: Array<{type: string; data: unknown}> = [];
        try {
          for await (const event of this.streamRouteHandler!(path, body)) {
            events.push(event);
          }
        } catch (err) {
          events.push({ type: "error", data: { error: err instanceof Error ? err.message : String(err) } });
        }
        // Return as SSE text so client can parse it
        const sseBody = events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`).join("");
        return new Response(sseBody, {
          status: 200,
          headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
        });
      }
    }

    // Non-streaming endpoints
    if (this.routeHandler) {
      try {
        const result = await this.routeHandler(path, method, body);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: msg }), {
          status: 500,
          headers: { "content-type": "application/json" },
        });
      }
    }

    // Fallback: try HTTP (dev mode with server running)
    return window.fetch(`http://127.0.0.1:8787${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  }

  isMobile(): boolean { return true; }
}

// ─── Singleton + auto-detection ─────────────────────────────────

function detectMobile(): boolean {
  if ((window as any).Capacitor) return true;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  return false;
}

const httpAdapter = new HttpApiAdapter();
const directAdapter = new DirectApiAdapter();

let activeAdapter: ApiAdapter = detectMobile() ? directAdapter : httpAdapter;

export function getAdapter(): ApiAdapter { return activeAdapter; }
export function setAdapter(adapter: ApiAdapter) { activeAdapter = adapter; }
export function getDirectAdapter(): DirectApiAdapter { return directAdapter; }
export { HttpApiAdapter, DirectApiAdapter };
