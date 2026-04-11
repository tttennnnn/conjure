import { describe, it, expect } from "vitest";
import { isValidProvider, validateKeyFormat, maskKey } from "@/lib/vault/api-keys";

describe("isValidProvider", () => {
  it("accepts anthropic", () => expect(isValidProvider("anthropic")).toBe(true));
  it("rejects openai", () => expect(isValidProvider("openai")).toBe(false));
  it("rejects empty", () => expect(isValidProvider("")).toBe(false));
});

describe("validateKeyFormat", () => {
  it("returns null for valid anthropic key", () => {
    expect(validateKeyFormat("anthropic", "sk-ant-abcdefghij1234567890")).toBeNull();
  });

  it("rejects key shorter than 16 chars", () => {
    const result = validateKeyFormat("anthropic", "sk-ant-short");
    expect(result).toMatch(/at least 16/);
  });

  it("rejects wrong prefix for anthropic", () => {
    const result = validateKeyFormat("anthropic", "wrong-prefix-abcdefghij");
    expect(result).toMatch(/sk-ant-/);
  });
});

describe("maskKey", () => {
  it("masks long key to prefix...suffix format", () => {
    const masked = maskKey("sk-ant-abc123456789xyz");
    expect(masked).toBe("sk-ant...9xyz");
  });

  it("returns **** for short key", () => {
    expect(maskKey("short")).toBe("****");
  });
});
