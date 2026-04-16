import { describe, it, expect } from "vitest";
import {
  isValidTargetEnv,
  isValidIacTool,
  isValidModel,
  sanitizeSessionName,
  isValidGithubRepo,
  isValidGithubBranch,
  resolveModelId,
  getAvailableModels,
  getModelById,
} from "@/lib/sessions/validation";

describe("isValidTargetEnv", () => {
  it("accepts aws", () => expect(isValidTargetEnv("aws")).toBe(true));
  it("accepts gcp", () => expect(isValidTargetEnv("gcp")).toBe(true));
  it("rejects azure", () => expect(isValidTargetEnv("azure")).toBe(false));
  it("rejects empty", () => expect(isValidTargetEnv("")).toBe(false));
});

describe("isValidIacTool", () => {
  it("accepts terraform", () => expect(isValidIacTool("terraform")).toBe(true));
  it("rejects pulumi", () => expect(isValidIacTool("pulumi")).toBe(false));
  it("rejects empty", () => expect(isValidIacTool("")).toBe(false));
});

describe("isValidModel", () => {
  it("accepts claude-sonnet", () => expect(isValidModel("claude-sonnet")).toBe(true));
  it("accepts nemotron-super-120b", () => expect(isValidModel("nemotron-super-120b")).toBe(true));
  it("accepts gpt-oss-120b", () => expect(isValidModel("gpt-oss-120b")).toBe(true));
  it("rejects unknown model", () => expect(isValidModel("gpt-5")).toBe(false));
  it("rejects empty", () => expect(isValidModel("")).toBe(false));
});

describe("sanitizeSessionName", () => {
  it("returns trimmed name", () => expect(sanitizeSessionName("  My Session  ")).toBe("My Session"));
  it("returns null for empty", () => expect(sanitizeSessionName("")).toBeNull());
  it("returns null for whitespace-only", () => expect(sanitizeSessionName("   ")).toBeNull());
  it("returns null for >100 chars", () => expect(sanitizeSessionName("a".repeat(101))).toBeNull());
  it("accepts exactly 100 chars", () => {
    const name = "a".repeat(100);
    expect(sanitizeSessionName(name)).toBe(name);
  });
  it("accepts 1 char", () => expect(sanitizeSessionName("x")).toBe("x"));
});

describe("isValidGithubRepo", () => {
  it("accepts owner/repo", () => expect(isValidGithubRepo("owner/repo")).toBe(true));
  it("accepts dots and hyphens", () => expect(isValidGithubRepo("my-org/repo.v2")).toBe(true));
  it("rejects no slash", () => expect(isValidGithubRepo("noslash")).toBe(false));
  it("rejects multiple slashes", () => expect(isValidGithubRepo("a/b/c")).toBe(false));
  it("rejects >200 chars", () => expect(isValidGithubRepo("a".repeat(100) + "/" + "b".repeat(101))).toBe(false));
  it("rejects spaces", () => expect(isValidGithubRepo("owner/my repo")).toBe(false));
});

describe("isValidGithubBranch", () => {
  it("accepts main", () => expect(isValidGithubBranch("main")).toBe(true));
  it("accepts feature/foo", () => expect(isValidGithubBranch("feature/foo")).toBe(true));
  it("accepts hyphens and dots", () => expect(isValidGithubBranch("release-1.0")).toBe(true));
  it("rejects empty", () => expect(isValidGithubBranch("")).toBe(false));
  it("rejects ..", () => expect(isValidGithubBranch("a..b")).toBe(false));
  it("rejects @{", () => expect(isValidGithubBranch("a@{b")).toBe(false));
  it("rejects leading dot", () => expect(isValidGithubBranch(".hidden")).toBe(false));
  it("rejects trailing dot", () => expect(isValidGithubBranch("branch.")).toBe(false));
  it("rejects .lock suffix", () => expect(isValidGithubBranch("a.lock")).toBe(false));
  it("rejects bare @", () => expect(isValidGithubBranch("@")).toBe(false));
  it("rejects //", () => expect(isValidGithubBranch("a//b")).toBe(false));
  it("rejects leading /", () => expect(isValidGithubBranch("/main")).toBe(false));
  it("rejects trailing /", () => expect(isValidGithubBranch("main/")).toBe(false));
  it("rejects spaces", () => expect(isValidGithubBranch("my branch")).toBe(false));
  it("rejects >255 chars", () => expect(isValidGithubBranch("a".repeat(256))).toBe(false));
});

describe("resolveModelId", () => {
  it("resolves anthropic model", () => {
    const result = resolveModelId("claude-sonnet");
    expect(result).not.toBeNull();
    expect(result!.provider).toBe("anthropic");
    expect(result!.modelId).toBe("claude-sonnet-4-6");
    expect(result!.disableReasoning).toBe(false);
  });

  it("resolves openrouter model with disableReasoning", () => {
    const result = resolveModelId("nemotron-super-120b");
    expect(result).not.toBeNull();
    expect(result!.provider).toBe("openrouter");
    expect(result!.disableReasoning).toBe(true);
  });

  it("returns null for unknown model", () => {
    expect(resolveModelId("unknown-model")).toBeNull();
  });
});

describe("getAvailableModels", () => {
  it("returns only free models when no keys provided", () => {
    const models = getAvailableModels({});
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((m) => m.tier === "free")).toBe(true);
  });

  it("includes anthropic models when key is present", () => {
    const models = getAvailableModels({ anthropic: true });
    expect(models.some((m) => m.provider === "anthropic")).toBe(true);
    expect(models.some((m) => m.tier === "free")).toBe(true);
  });

  it("excludes anthropic models when key is false", () => {
    const models = getAvailableModels({ anthropic: false });
    expect(models.every((m) => m.provider !== "anthropic")).toBe(true);
  });
});

describe("getModelById", () => {
  it("finds known model", () => {
    const model = getModelById("claude-haiku");
    expect(model).toBeDefined();
    expect(model!.name).toBe("Claude Haiku 4.5");
  });

  it("returns undefined for unknown", () => {
    expect(getModelById("nonexistent")).toBeUndefined();
  });
});
