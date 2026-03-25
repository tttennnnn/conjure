import { parse } from "yaml";

const BANNED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  nodeIds: string[];
}

export function validateConfigYaml(yamlString: string): ConfigValidationResult {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = parse(yamlString);
  } catch (err) {
    return {
      valid: false,
      errors: [`YAML parse error: ${err instanceof Error ? err.message : String(err)}`],
      nodeIds: [],
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { valid: false, errors: ["Config must be a YAML object"], nodeIds: [] };
  }

  const root = parsed as Record<string, unknown>;

  if (!("nodes" in root)) {
    return { valid: false, errors: ["Config must have a 'nodes' top-level key"], nodeIds: [] };
  }

  const nodes = root.nodes;
  if (typeof nodes !== "object" || nodes === null || Array.isArray(nodes)) {
    return { valid: false, errors: ["'nodes' must be an object"], nodeIds: [] };
  }

  const nodeEntries = Object.entries(nodes as Record<string, unknown>);
  const nodeIds: string[] = [];

  for (const [key, value] of nodeEntries) {
    if (BANNED_KEYS.has(key)) {
      errors.push(`Banned key name: ${key}`);
      continue;
    }

    nodeIds.push(key);

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errors.push(`Node '${key}' must be an object`);
      continue;
    }

    const node = value as Record<string, unknown>;
    if (!node.resource || typeof node.resource !== "string") {
      errors.push(`Node '${key}' is missing a 'resource' field (string)`);
    }
  }

  return { valid: errors.length === 0, errors, nodeIds };
}

export function extractConfigNodeIds(yamlString: string): string[] {
  try {
    const parsed = parse(yamlString) as Record<string, unknown>;
    const nodes = parsed?.nodes;
    if (typeof nodes === "object" && nodes !== null && !Array.isArray(nodes)) {
      return Object.keys(nodes as Record<string, unknown>);
    }
  } catch {
    // Invalid YAML
  }
  return [];
}
