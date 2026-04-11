import { describe, it, expect } from "vitest";
import { stripThinkingBlocks, extractDelimitedBlock, extractBlocks } from "@/lib/llm/parse";

describe("stripThinkingBlocks", () => {
  it("removes <think> blocks", () => {
    const raw = "Hello <think>internal reasoning</think> World";
    expect(stripThinkingBlocks(raw)).toBe("Hello  World");
  });

  it("removes <thinking> blocks", () => {
    const raw = "<thinking>deep thought</thinking>Result here";
    expect(stripThinkingBlocks(raw)).toBe("Result here");
  });

  it("is case-insensitive", () => {
    const raw = "<THINK>stuff</THINK>ok";
    expect(stripThinkingBlocks(raw)).toBe("ok");
  });

  it("removes multiple think blocks", () => {
    const raw = "<think>a</think>mid<think>b</think>end";
    expect(stripThinkingBlocks(raw)).toBe("midend");
  });

  it("returns text unchanged when no think blocks", () => {
    expect(stripThinkingBlocks("no thinking here")).toBe("no thinking here");
  });
});

describe("extractDelimitedBlock", () => {
  it("extracts content between markers", () => {
    const text = "prefix <<<MERMAID>>>\ngraph TD\nA --> B\n<<<END_MERMAID>>> suffix";
    expect(extractDelimitedBlock(text, "MERMAID")).toBe("graph TD\nA --> B");
  });

  it("returns empty string when open marker missing", () => {
    expect(extractDelimitedBlock("no markers here", "MERMAID")).toBe("");
  });

  it("returns empty string when close marker missing", () => {
    expect(extractDelimitedBlock("<<<MERMAID>>>content", "MERMAID")).toBe("");
  });

  it("works with CONFIG tag", () => {
    const text = "<<<CONFIG>>>\nnodes:\n  db:\n    resource: rds\n<<<END_CONFIG>>>";
    const result = extractDelimitedBlock(text, "CONFIG");
    expect(result).toContain("nodes:");
  });
});

describe("extractBlocks", () => {
  it("extracts mermaid and config from delimited blocks", () => {
    const raw = `Here is the updated infrastructure.

<<<MERMAID>>>
graph TD
    web[Web] --> db[DB]
<<<END_MERMAID>>>

<<<CONFIG>>>
nodes:
  web:
    resource: aws_instance
  db:
    resource: aws_db_instance
<<<END_CONFIG>>>`;

    const result = extractBlocks(raw);
    expect(result.mermaidCode).toContain("graph TD");
    expect(result.configYaml).toContain("nodes:");
    expect(result.chatText).toContain("updated infrastructure");
  });

  it("extracts from fenced code blocks as fallback", () => {
    const raw = "Some explanation\n\n```mermaid\ngraph TD\nA --> B\n```\n\n```yaml\nnodes:\n  a:\n    resource: x\n```";
    const result = extractBlocks(raw);
    expect(result.mermaidCode).toContain("graph TD");
    expect(result.configYaml).toContain("nodes:");
  });

  it("returns chat-only when no blocks", () => {
    const raw = "VPCs provide network isolation for your cloud resources.";
    const result = extractBlocks(raw);
    expect(result.chatText).toBe(raw);
    expect(result.mermaidCode).toBeNull();
    expect(result.configYaml).toBeNull();
  });

  it("provides default chat text when blocks present but no text", () => {
    const raw = `<<<MERMAID>>>
graph TD
    a[A]
<<<END_MERMAID>>>`;
    const result = extractBlocks(raw);
    expect(result.mermaidCode).not.toBeNull();
    expect(result.chatText.length).toBeGreaterThan(0);
  });

  it("picks YAML fence containing nodes: when multiple exist", () => {
    const raw = `text\n\n\`\`\`yaml\nother: stuff\n\`\`\`\n\n\`\`\`yaml\nnodes:\n  db:\n    resource: rds\n\`\`\``;
    const result = extractBlocks(raw);
    expect(result.configYaml).toContain("nodes:");
  });

  it("detects raw mermaid pattern as fallback", () => {
    const raw = `Here is the diagram:

graph TD
    a[Server] --> b[Database]

That should work.`;
    const result = extractBlocks(raw);
    expect(result.mermaidCode).toContain("graph TD");
  });

  it("unwraps outer triple-backtick fence", () => {
    const raw = "```\n<<<MERMAID>>>\ngraph TD\nA[A]\n<<<END_MERMAID>>>\n```";
    const result = extractBlocks(raw);
    expect(result.mermaidCode).toContain("graph TD");
  });
});
