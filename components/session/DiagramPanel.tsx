"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { validateMermaid } from "@/lib/mermaid/validate";
import SyntaxEditor from "@/components/ui/SyntaxEditor";

interface DiagramPanelProps {
  mermaidCode: string;
  isStale: boolean;
  hasCode: boolean;
  isGenerating: boolean;
  codeError?: string | null;
  /** When true, suppresses the "Diagram" tab label (outer context already provides the tab bar). */
  hasOuterTabs?: boolean;
  onGenerateCode: () => void;
  onEditSave: (newMermaidCode: string) => void;
  onNodeClick?: (nodeId: string) => void;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

export default function DiagramPanel({
  mermaidCode,
  isStale,
  hasCode,
  isGenerating,
  codeError,
  hasOuterTabs = false,
  onGenerateCode,
  onEditSave,
  onNodeClick,
}: DiagramPanelProps) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState(mermaidCode);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderCounter = useRef(0);
  const mermaidInitRef = useRef(false);

  function zoomIn() { setZoom((z) => Math.min(MAX_ZOOM, parseFloat((z + ZOOM_STEP).toFixed(2)))); }
  function zoomOut() { setZoom((z) => Math.max(MIN_ZOOM, parseFloat((z - ZOOM_STEP).toFixed(2)))); }
  function zoomReset() { setZoom(1); }

  // Keep edit buffer in sync when mermaid changes externally (e.g. chat update)
  useEffect(() => {
    if (!editMode) setEditValue(mermaidCode);
  }, [mermaidCode, editMode]);

  const renderDiagram = useCallback(async (code: string) => {
    if (typeof window === "undefined") return;

    // Client-side validation before rendering
    const validation = validateMermaid(code);
    if (!validation.valid) {
      setError(`Diagram validation failed: ${validation.errors.join(", ")}`);
      setSvgContent(null);
      return;
    }

    try {
      const mermaid = (await import("mermaid")).default;
      if (!mermaidInitRef.current) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "Inter, sans-serif",
        });
        mermaidInitRef.current = true;
      }

      renderCounter.current += 1;
      const id = `conjure-diagram-${renderCounter.current}`;
      const { svg } = await mermaid.render(id, code);
      setSvgContent(svg);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render diagram");
      setSvgContent(null);
    }
  }, []);

  useEffect(() => {
    if (!mermaidCode) {
      setSvgContent(null);
      setError(null);
      return;
    }
    if (!editMode) renderDiagram(mermaidCode);
  }, [mermaidCode, editMode, renderDiagram]);

  // Ctrl+scroll to zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function handleWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => {
        const next = e.deltaY < 0 ? z + ZOOM_STEP : z - ZOOM_STEP;
        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parseFloat(next.toFixed(2))));
      });
    }
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Delegated click handler: listen on the stable container so clicks keep
  // working even if the SVG DOM is reconciled after a React re-render.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onNodeClick) return;
    const notify = onNodeClick;

    function handleClick(e: MouseEvent) {
      // Walk up from the click target to find the nearest .node ancestor
      let el = e.target as Element | null;
      while (el && el !== container) {
        if (el.classList?.contains("node")) {
          const match = el.id.match(/^flowchart-(.+)-\d+$/);
          if (match?.[1]) notify(match[1]);
          return;
        }
        el = el.parentElement;
      }
    }

    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [onNodeClick]);

  function handleEditSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== mermaidCode) onEditSave(trimmed);
    setEditMode(false);
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleEditSave();
    }
    if (e.key === "Escape") {
      setEditValue(mermaidCode);
      setEditMode(false);
    }
  }

  function handleExport() {
    if (!mermaidCode) return;
    const blob = new Blob([mermaidCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "diagram.mmd";
    a.click();
    URL.revokeObjectURL(url);
  }

  const generateLabel = isGenerating ? "Generating…" : hasCode ? "Regenerate" : "Generate Code";

  return (
    <div className="flex flex-1 flex-col min-w-0 bg-[var(--bg)]">
      {/* Tab bar + toolbar */}
      <div className="flex h-[38px] shrink-0 items-end justify-between border-b border-[var(--border)] bg-[var(--surface)] px-2.5">
        {!hasOuterTabs && (
          <div className="flex h-[30px] items-center rounded-t-md border border-b-0 border-[var(--border)] bg-[var(--bg)] px-3 text-[10px] font-medium text-[var(--text)]">
            Diagram
          </div>
        )}
        {/* Spacer so toolbar right-aligns whether or not the tab label is shown */}
        {hasOuterTabs && <div />}
        <div className="flex items-center gap-1 pb-1">
          <button
            onClick={() => { if (editMode) { handleEditSave(); } else { setEditValue(mermaidCode); setEditMode(true); } }}
            className={["rounded px-2 py-0.5 text-[10px] transition-colors", editMode ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"].join(" ")}
          >
            {editMode ? "Save" : "Edit"}
          </button>
          <button
            onClick={handleExport}
            disabled={!mermaidCode}
            className="rounded px-2 py-0.5 text-[10px] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            Export
          </button>
          {/* Zoom controls — only shown when a diagram is rendered */}
          {svgContent && !editMode && (
            <div className="flex items-center gap-0.5 rounded border border-[var(--border)] bg-[var(--bg)] px-0.5">
              <button onClick={zoomOut} disabled={zoom <= MIN_ZOOM} className="flex h-5 w-5 items-center justify-center text-[10px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30" title="Zoom out">−</button>
              <button onClick={zoomReset} className="min-w-[36px] text-center text-[10px] text-[var(--muted)] hover:text-[var(--text)] tabular-nums" title="Reset zoom">{Math.round(zoom * 100)}%</button>
              <button onClick={zoomIn} disabled={zoom >= MAX_ZOOM} className="flex h-5 w-5 items-center justify-center text-[10px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-30" title="Zoom in">+</button>
            </div>
          )}
          <button
            onClick={onGenerateCode}
            disabled={isGenerating || !mermaidCode}
            className="flex items-center gap-1 rounded bg-[var(--accent)] px-2.5 py-0.5 text-[10px] font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:pointer-events-none"
          >
            {isGenerating && <span className="inline-block h-2 w-2 animate-spin rounded-full border border-white border-t-transparent" />}
            {generateLabel}
          </button>
          {codeError && (
            <span className="text-[10px] text-[var(--danger-text)]">{codeError}</span>
          )}
        </div>
      </div>

      {/* Stale banner */}
      {isStale && hasCode && (
        <div className="shrink-0 border-b border-[var(--warning-border,#f59e0b)] bg-[var(--warning-bg,#fef3c7)] px-4 py-2 text-[11px] text-[var(--warning-text,#92400e)]">
          Code is out of date — click Regenerate.
        </div>
      )}

      {/* Diagram canvas */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-auto p-6"
      >
        {editMode ? (
          <SyntaxEditor
            value={editValue}
            onChange={setEditValue}
            onKeyDown={handleEditKeyDown}
            language="mermaid"
            className="h-full w-full"
          />
        ) : (<>
        {!mermaidCode && !error && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--surface)] text-[22px] text-[var(--hint)]">
              ◇
            </div>
            <div className="text-sm font-semibold text-[var(--text)]">No diagram yet</div>
            <div className="max-w-[300px] text-center text-xs leading-relaxed text-[var(--muted)]">
              Start chatting to design your infrastructure. The diagram will appear here as you describe your architecture.
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-[400px] rounded-lg border border-[var(--danger-text)]/30 bg-[var(--danger-bg)] p-4">
            <div className="text-[11px] font-semibold text-[var(--danger-text)]">
              Diagram render error
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-[var(--danger-text)]">
              {error}
            </div>
          </div>
        )}

        {svgContent && (
          <div
            className="mermaid-container"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center top", transition: "transform 0.15s ease" }}
            // Safe: validateMermaid() rejects dangerous HTML patterns client-side,
            // and mermaid.js securityLevel: "strict" sanitizes SVG output
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
        </>)}
      </div>
    </div>
  );
}
