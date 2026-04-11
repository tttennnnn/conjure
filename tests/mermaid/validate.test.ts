import { describe, it, expect } from "vitest";
import { validateMermaid, extractMermaidNodeIds } from "@/lib/mermaid/validate";

describe("validateMermaid", () => {
  it("validates a correct flowchart", () => {
    const code = `graph TD
    internet[Internet]
    alb[Load Balancer]
    internet --> alb`;
    const result = validateMermaid(code);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.nodeIds).toContain("internet");
    expect(result.nodeIds).toContain("alb");
  });

  it("accepts flowchart keyword", () => {
    const code = `flowchart LR
    a[A] --> b[B]`;
    const result = validateMermaid(code);
    expect(result.valid).toBe(true);
  });

  it("rejects missing graph declaration", () => {
    const code = `a[A] --> b[B]`;
    const result = validateMermaid(code);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/must start with/i);
  });

  it("detects <script> injection", () => {
    const code = `graph TD
    a[<script>alert(1)</script>]`;
    const result = validateMermaid(code);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("dangerous"))).toBe(true);
  });

  it("detects onclick injection", () => {
    const code = `graph TD
    a[Node onclick=alert(1)]`;
    const result = validateMermaid(code);
    expect(result.valid).toBe(false);
  });

  it("detects javascript: URI", () => {
    const code = `graph TD
    a[javascript:alert(1)]`;
    const result = validateMermaid(code);
    expect(result.valid).toBe(false);
  });

  it("detects unbalanced brackets", () => {
    const code = `graph TD
    a[Unclosed`;
    const result = validateMermaid(code);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Unbalanced"))).toBe(true);
  });

  it("reports empty code", () => {
    const result = validateMermaid("");
    expect(result.valid).toBe(false);
  });

  it("extracts node IDs from complex graph", () => {
    const code = `graph TD
    web[Web Server]
    db[(Database)]
    cache{Cache}
    web --> db
    web --> cache`;
    const result = validateMermaid(code);
    expect(result.valid).toBe(true);
    expect(result.nodeIds).toEqual(expect.arrayContaining(["web", "db", "cache"]));
  });
});

describe("extractMermaidNodeIds", () => {
  it("extracts IDs from definitions and connections", () => {
    const code = `graph TD
    a[A] --> b[B]
    b --> c[C]`;
    const ids = extractMermaidNodeIds(code);
    expect(ids).toEqual(expect.arrayContaining(["a", "b", "c"]));
  });

  it("filters out Mermaid keywords", () => {
    const code = `graph TD
    subgraph cluster
    a[Node]
    end`;
    const ids = extractMermaidNodeIds(code);
    expect(ids).not.toContain("graph");
    expect(ids).not.toContain("subgraph");
    expect(ids).not.toContain("end");
    expect(ids).toContain("a");
  });

  it("handles different arrow types", () => {
    const code = `graph TD
    a --> b
    c --- d
    e -.-> f
    g ==> h`;
    const ids = extractMermaidNodeIds(code);
    expect(ids).toEqual(expect.arrayContaining(["a", "b", "c", "d", "e", "f", "g", "h"]));
  });

  it("deduplicates IDs", () => {
    const code = `graph TD
    a[A] --> b[B]
    a --> b`;
    const ids = extractMermaidNodeIds(code);
    const uniqueIds = [...new Set(ids)];
    expect(ids.length).toBe(uniqueIds.length);
  });
});
