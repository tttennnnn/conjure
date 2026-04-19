"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { parse } from "yaml";
import { extractNodeYaml, replaceNodeInYaml } from "@/lib/config/node-yaml";
import SyntaxEditor from "@/components/ui/SyntaxEditor";
import type { ChatMessageData } from "@/lib/chat/types";

const DEFAULT_WIDTH = 272;
const MIN_WIDTH = 200;
const MAX_WIDTH = 520;

interface PropertiesDrawerProps {
  nodeId: string;
  configYaml: string;
  sessionId: string;
  onClose: () => void;
  onSaved: (newConfigYaml: string, iacStale: boolean, eventMessage: ChatMessageData | null) => void;
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
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const dragListeners = useRef<{ onMove: (e: MouseEvent) => void; onUp: () => void } | null>(null);

  // Clean up document listeners and body styles if the drawer unmounts mid-drag
  useEffect(() => {
    return () => {
      if (dragListeners.current) {
        document.removeEventListener("mousemove", dragListeners.current.onMove);
        document.removeEventListener("mouseup", dragListeners.current.onUp);
        dragListeners.current = null;
      }
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, []);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    setIsDragging(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return;
      setWidth((w) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w - ev.movementX)));
    }
    function onUp() {
      dragging.current = false;
      setIsDragging(false);
      dragListeners.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    dragListeners.current = { onMove, onUp };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

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
      const data = await res.json() as { configYaml: string; iacStale: boolean; eventMessages: ChatMessageData[] };
      onSaved(data.configYaml, data.iacStale, data.eventMessages?.[0] ?? null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSave();
    }
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="relative flex shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)]" style={{ width }}>
      {/* Drag handle — left edge resize */}
      <div
        onMouseDown={startDrag}
        className={`absolute inset-y-0 left-0 w-1 cursor-col-resize z-10 ${isDragging ? "bg-[var(--accent)]/20" : "hover:bg-[var(--accent)]/20"}`}
      />
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
          <SyntaxEditor
            value={editValue}
            onChange={(v) => { setEditValue(v); setError(null); }}
            onKeyDown={handleKeyDown}
            language="yaml"
            style={{ minHeight: 180 }}
          />
        )}

        {error && (
          <div className="rounded border border-[var(--danger-text)]/25 bg-[var(--danger-bg)] px-2.5 py-2 text-[10px] text-[var(--danger-text)]">
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
              className="rounded bg-[var(--accent)] px-2.5 py-1 text-[10px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:pointer-events-none"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
