export interface Citation {
  url: string;
  fetchedAt: string;
  documentVersion?: string;
  apiVersion?: string;
  location: string;
}

export interface DocsFinding {
  topic: string;
  summary: string;
  citation: Citation;
  requiresApproval: boolean;
  official: boolean;
}

const officialHosts = [
  "openai.com", "platform.openai.com", "anthropic.com", "ai.google.dev",
  "cloud.google.com", "deepseek.com", "dashscope.aliyuncs.com",
  "help.aliyun.com", "moonshot.cn", "ollama.com", "vitejs.dev",
  "react.dev", "github.com", "npmjs.com", "pypi.org",
];

export async function researchOfficialDocs(input: {
  topic: string;
  url: string;
  fetcher?: typeof fetch;
}): Promise<DocsFinding> {
  const fetcher = input.fetcher ?? fetch;
  const official = isOfficialUrl(input.url);
  const response = await fetcher(input.url);
  const text = await response.text();
  return {
    topic: input.topic,
    summary: summarize(text),
    requiresApproval: !official,
    official,
    citation: { url: input.url, fetchedAt: new Date().toISOString(), location: "document" },
  };
}

export function isOfficialUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return officialHosts.some((official) => host === official || host.endsWith(`.${official}`));
  } catch {
    return false;
  }
}

export function createIntegrationNote(input: {
  service: string; auth: string; endpoint: string; params: string;
  errorHandling: string; rateLimits: string; sdkInstall: string;
  minimalExample: string; sources: Citation[];
}): string {
  return [
    `# ${input.service} Integration Note`,
    `Auth: ${input.auth}`, `Endpoint: ${input.endpoint}`,
    `Params: ${input.params}`, `Error Handling: ${input.errorHandling}`,
    `Rate Limits: ${input.rateLimits}`, `SDK Install: ${input.sdkInstall}`,
    `Minimal Example: ${input.minimalExample}`, "Sources:",
    ...input.sources.map((s) => `- ${s.url} (${s.location}, fetched ${s.fetchedAt})`),
  ].join("\n");
}

function summarize(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280);
}
