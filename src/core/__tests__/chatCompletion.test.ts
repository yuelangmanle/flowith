import { describe, expect, it } from "vitest";
import { callChatCompletion, streamChatCompletion } from "../modelGateway";
import type { ProviderConfig } from "../types";

const openaiProvider: ProviderConfig = {
  id: "openai",
  type: "openai",
  name: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "sk-test",
  enabled: true,
  supportsModelList: true,
};

const anthropicProvider: ProviderConfig = {
  id: "anthropic",
  type: "anthropic",
  name: "Anthropic",
  baseUrl: "https://api.anthropic.com",
  apiKey: "sk-ant-test",
  enabled: true,
  supportsModelList: true,
};

describe("callChatCompletion", () => {
  it("calls OpenAI-compatible API and returns content", async () => {
    const result = await callChatCompletion(
      {
        provider: openaiProvider,
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      },
      async (url, options) => {
        expect(String(url)).toBe("https://api.openai.com/v1/chat/completions");
        const body = JSON.parse(options?.body as string);
        expect(body.model).toBe("gpt-4");
        expect(body.messages[0].content).toBe("Hello");
        expect(body.stream).toBe(false);
        return new Response(JSON.stringify({
          choices: [{ message: { content: "Hi there!" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }));
      }
    );
    expect(result.content).toBe("Hi there!");
    expect(result.usage).toMatchObject({ prompt: 10, completion: 5 });
  });

  it("calls Anthropic API with correct format", async () => {
    const result = await callChatCompletion(
      {
        provider: anthropicProvider,
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Hello" },
        ],
      },
      async (url, options) => {
        expect(String(url)).toBe("https://api.anthropic.com/messages");
        const body = JSON.parse(options?.body as string);
        expect(body.model).toBe("claude-sonnet-4-20250514");
        expect(Array.isArray(body.system) ? body.system[0].text : body.system).toBe("You are helpful.");
        expect(body.messages[0].role).toBe("user");
        return new Response(JSON.stringify({
          content: [{ text: "Hello! How can I help?" }],
          usage: { input_tokens: 15, output_tokens: 8 },
        }));
      }
    );
    expect(result.content).toBe("Hello! How can I help?");
    expect(result.usage).toMatchObject({ prompt: 15, completion: 8 });
  });

  it("throws on API error", async () => {
    await expect(
      callChatCompletion(
        { provider: openaiProvider, model: "gpt-4", messages: [{ role: "user", content: "test" }] },
        async () => new Response("Unauthorized", { status: 401 })
      )
    ).rejects.toThrow("API error 401");
  });
});

describe("streamChatCompletion", () => {
  it("streams OpenAI SSE chunks", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    let chunkIndex = 0;

    const result: string[] = [];
    for await (const chunk of streamChatCompletion(
      { provider: openaiProvider, model: "gpt-4", messages: [{ role: "user", content: "Hi" }], stream: true },
      async () => {
        const stream = new ReadableStream({
          pull(controller) {
            if (chunkIndex < chunks.length) {
              controller.enqueue(encoder.encode(chunks[chunkIndex++]));
            } else {
              controller.close();
            }
          },
        });
        return new Response(stream, { headers: { "content-type": "text/event-stream" } });
      }
    )) {
      if (chunk.type === "text" && chunk.content) {
        result.push(chunk.content);
      }
    }
    expect(result).toEqual(["Hello", " world"]);
  });
});
