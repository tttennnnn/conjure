// Virtual nodes allowed in Mermaid without a Config entry
const VIRTUAL_NODES = new Set(["internet", "users", "client", "external"]);

export interface SyncResult {
  inSync: boolean;
  mermaidOnly: string[];
  configOnly: string[];
}

export function checkNodeIdSync(
  mermaidNodeIds: string[],
  configNodeIds: string[],
): SyncResult {
  const mermaidSet = new Set(mermaidNodeIds);
  const configSet = new Set(configNodeIds);

  const mermaidOnly = mermaidNodeIds.filter(
    (id) => !configSet.has(id) && !VIRTUAL_NODES.has(id),
  );
  const configOnly = configNodeIds.filter((id) => !mermaidSet.has(id));

  return {
    inSync: mermaidOnly.length === 0 && configOnly.length === 0,
    mermaidOnly,
    configOnly,
  };
}
