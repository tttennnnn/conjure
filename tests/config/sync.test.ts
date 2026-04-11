import { describe, it, expect } from "vitest";
import { checkNodeIdSync } from "@/lib/config/sync";

describe("checkNodeIdSync", () => {
  it("returns inSync when IDs match", () => {
    const result = checkNodeIdSync(["alb", "rds"], ["alb", "rds"]);
    expect(result.inSync).toBe(true);
    expect(result.mermaidOnly).toHaveLength(0);
    expect(result.configOnly).toHaveLength(0);
  });

  it("allows virtual nodes in Mermaid only", () => {
    const result = checkNodeIdSync(["internet", "alb", "users"], ["alb"]);
    expect(result.inSync).toBe(true);
    expect(result.mermaidOnly).toHaveLength(0);
  });

  it("detects Mermaid-only non-virtual nodes", () => {
    const result = checkNodeIdSync(["alb", "rds", "redis"], ["alb", "rds"]);
    expect(result.inSync).toBe(false);
    expect(result.mermaidOnly).toEqual(["redis"]);
  });

  it("detects config-only nodes", () => {
    const result = checkNodeIdSync(["alb"], ["alb", "rds"]);
    expect(result.inSync).toBe(false);
    expect(result.configOnly).toEqual(["rds"]);
  });

  it("detects both-direction mismatch", () => {
    const result = checkNodeIdSync(["alb", "extra_m"], ["alb", "extra_c"]);
    expect(result.inSync).toBe(false);
    expect(result.mermaidOnly).toEqual(["extra_m"]);
    expect(result.configOnly).toEqual(["extra_c"]);
  });

  it("handles empty arrays", () => {
    const result = checkNodeIdSync([], []);
    expect(result.inSync).toBe(true);
  });

  it("allows all virtual node names", () => {
    const result = checkNodeIdSync(["internet", "users", "client", "external"], []);
    expect(result.inSync).toBe(true);
  });
});
