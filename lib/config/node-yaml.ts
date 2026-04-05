import { parse, stringify } from "yaml";

/** Extract the YAML block for a single node from the full config. */
export function extractNodeYaml(configYaml: string, nodeId: string): string {
  try {
    const parsed = parse(configYaml) as { nodes: Record<string, unknown> };
    const nodeData = parsed?.nodes?.[nodeId];
    if (nodeData === undefined) return "";
    return stringify(nodeData).trimEnd();
  } catch {
    return "";
  }
}

/** Replace a single node's config within the full YAML, returning the updated string. */
export function replaceNodeInYaml(configYaml: string, nodeId: string, nodeYaml: string): string {
  const full = parse(configYaml) as { nodes: Record<string, unknown> };
  full.nodes[nodeId] = parse(nodeYaml);
  return stringify(full);
}
