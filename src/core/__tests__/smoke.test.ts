import { describe, expect, it } from "vitest";
import { appMetadata } from "../demoData";

describe("app metadata", () => {
  it("describes the multi-agent workspace MVP", () => {
    expect(appMetadata.name).toBe("Multi-Agent Workspace");
    expect(appMetadata.primaryFlow).toBe("project-generation");
    expect(appMetadata.modules).toContain("model-gateway");
    expect(appMetadata.modules).toContain("roundtable");
  });
});
