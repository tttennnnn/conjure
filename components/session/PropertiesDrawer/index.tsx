"use client";

import { useState, useEffect } from "react";
import { parse } from "yaml";
import { extractNodeYaml, replaceNodeInYaml } from "@/lib/config/node-yaml";

interface PropertiesDrawerProps {
  nodeId: string;
  configYaml: string;
  sessionId: string;
  onClose: () => void;
  onSaved: (newConfigYaml: string, iacStale: boolean) => void;
}

export default function PropertiesDrawer({
  nodeId,
  configYaml,
  sessionId,
  onClose,
  onSaved,
}: PropertiesDrawerProps) {
  const [editValue, setEditValue] = useState(() => extractNodeYaml(configYaml, nodeId));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync when the selected node changes
  useEffect(() => {
    setEditValue(extractNodeYaml(configYaml, nodeId));
    setError(null);
  }, [nodeId, configYaml]);

  const hasEntry = !!extractNodeYaml(configYaml, nodeId);

  async function handleSave() {
    const trimmed = editValue.trim();
    if (!trimmed) return;

    let nodeData: unknown;
    try {
      nodeData = parse(trimmed);
    } catch (err) {
      setError(`YAML error: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    if (typeof nodeData !== "object" || nodeData === null || Array.isArray(nodeData)) {
      setError("Node config must be a YAML object");
      return;
    }

    const nodeObj = nodeData as Record<string, unknown>;
    if (!nodeObj.resource || typeof nodeObj.resource !== "string") {
      setError("Node must have a 'resource' field (string)");
      return;
    }

    let newConfigYaml: string;
    try {
      newConfigYaml = replaceNodeInYaml(configYaml, nodeId, trimmed);
    } catch (err) {
      setError(`Failed to update config: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configYaml: newConfigYaml }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError((data as { error?: string }).error ?? "Failed to save");
        return;
      }
      const data = await res.json() as { configYaml: string; iacStale: boolean };
      onSaved(data.configYaml, data.iacStale);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSave();
    }
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="flex w-[272px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)]">
      {/* Header */}
      <div className="flex h-[38px] shrink-0 items-center justify-between border-b border-[var(--border)] px-3">
        <span className="truncate text-[11px] font-semibold text-[var(--text)]">{nodeId}</span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors"
          aria-label="Close properties"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M1 1l10 10M11 1L1 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 overflow-auto p-3">
        {!hasEntry ? (
          <p className="text-[11px] text-[var(--muted)]">This node has no config entry.</p>
        ) : (
          <textarea
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            className="min-h-[180px] flex-1 resize-none rounded border border-[var(--border)] bg-[var(--bg)] p-2 font-[JetBrains_Mono,monospace] text-[11px] leading-relaxed text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent,#6366f1)]"
            spellCheck={false}
          />
        )}

        {error && (
          <div className="rounded border border-[var(--danger-bg,#fee2e2)] bg-[var(--danger-bg,#fee2e2)] px-2.5 py-2 text-[10px] text-[var(--danger-text,#991b1b)]">
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[var(--border)] px-3 py-2.5">
        <p className="mb-2 text-[9px] text-[var(--muted)]">
          conjure.config.yaml → {nodeId}
        </p>
        {hasEntry && (
          <div className="flex justify-end gap-1.5">
            <button
              onClick={onClose}
              className="rounded px-2.5 py-1 text-[10px] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="rounded bg-[var(--accent,#6366f1)] px-2.5 py-1 text-[10px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
