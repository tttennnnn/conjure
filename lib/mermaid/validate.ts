const MERMAID_KEYWORDS = new Set([
  "graph", "flowchart", "TD", "TB", "BT", "RL", "LR",
  "subgraph", "end", "style", "classDef", "click", "class",
  "direction",
]);

const DANGEROUS_PATTERNS = [
  /<script/i,
  /<img/i,
  /onclick/i,
  /javascript:/i,
  /onerror/i,
  /onload/i,
];

export interface MermaidValidationResult {
  valid: boolean;
  errors: string[];
  nodeIds: string[];
}

export function validateMermaid(code: string): MermaidValidationResult {
  const errors: string[] = [];
  const lines = code.trim().split("\n");

  if (lines.length === 0) {
    return { valid: false, errors: ["Empty Mermaid code"], nodeIds: [] };
  }

  // Check graph declaration
  const firstNonEmpty = lines.find((l) => l.trim().length > 0);
  if (!firstNonEmpty || !/^(graph|flowchart)\s+(TD|TB|BT|RL|LR)\s*$/.test(firstNonEmpty.trim())) {
    errors.push("Mermaid must start with 'graph TD' or 'flowchart TD' (or other direction)");
  }

  // Check for HTML injection
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      errors.push("Mermaid code contains potentially dangerous HTML");
      break;
    }
  }

  // Check balanced brackets
  const countChar = (str: string, ch: string) => {
    let count = 0;
    for (const c of str) if (c === ch) count++;
    return count;
  };
  if (countChar(code, "[") !== countChar(code, "]")) errors.push("Unbalanced square brackets");
  if (countChar(code, "(") !== countChar(code, ")")) errors.push("Unbalanced parentheses");
  if (countChar(code, "{") !== countChar(code, "}")) errors.push("Unbalanced curly braces");

  const nodeIds = extractMermaidNodeIds(code);

  return { valid: errors.length === 0, errors, nodeIds };
}

export function extractMermaidNodeIds(code: string): string[] {
  const ids = new Set<string>();

  // Match node definitions: nodeId[Label], nodeId(Label), nodeId{Label}, nodeId((Label))
  // Also handles :::className suffix (e.g. nodeId[Label]:::cls_database) — ID captured before [
  const defPattern = /^\s*(\w+)\s*[\[({]/gm;
  let match: RegExpExecArray | null;
  while ((match = defPattern.exec(code)) !== null) {
    ids.add(match[1]!);
  }

  // Match connection sources: nodeId --> ...
  const srcPattern = /^\s*(\w+)\s*(?:-->|---|-.->|==>)/gm;
  while ((match = srcPattern.exec(code)) !== null) {
    ids.add(match[1]!);
  }

  // Match connection targets: ... --> nodeId or ... -->|label| nodeId
  const tgtPattern = /(?:-->|---|-.->|==>)\s*(?:\|[^|]*\|\s*)?(\w+)/gm;
  while ((match = tgtPattern.exec(code)) !== null) {
    ids.add(match[1]!);
  }

  // Filter out Mermaid keywords
  for (const kw of MERMAID_KEYWORDS) {
    ids.delete(kw);
  }

  return Array.from(ids);
}
