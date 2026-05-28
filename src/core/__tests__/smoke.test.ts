import { describe, expect, it } from "vitest";
import { appMetadata } from "../demoData";

describe("app metadata", () => {
  it("describes the multi-agent workspace platform", () => {
    expect(appMetadata.name).toBe("Multi-Agent Workspace");
    expect(appMetadata.version).toBe("0.3.0");
    expect(appMetadata.modules).toContain("model-gateway");
    expect(appMetadata.modules).toContain("roundtable");
    expect(appMetadata.modules).toContain("streaming-chat");
    expect(appMetadata.modules).toContain("provider-settings");
    expect(appMetadata.modules).toContain("code-generation");
    expect(appMetadata.modules).toContain("custom-agents");
  });
});
