"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { validateMermaid } from "@/lib/mermaid/validate";

interface DiagramPanelProps {
  mermaidCode: string;
}

let mermaidInitialized = false;

export default function DiagramPanel({ mermaidCode }: DiagramPanelProps) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderCounter = useRef(0);

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
      if (!mermaidInitialized) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "neutral",
          fontFamily: "Inter, sans-serif",
        });
        mermaidInitialized = true;
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
    renderDiagram(mermaidCode);
  }, [mermaidCode, renderDiagram]);

  return (
    <div className="flex flex-1 flex-col min-w-0 bg-[var(--bg)]">
      {/* Tab bar */}
      <div className="flex h-[38px] shrink-0 items-end border-b border-[var(--border)] bg-[var(--surface)] px-2.5">
        <div className="flex h-[30px] items-center rounded-t-md border border-b-0 border-[var(--border)] bg-[var(--bg)] px-3 text-[10px] font-medium text-[var(--text)]">
          Diagram
        </div>
      </div>

      {/* Diagram canvas */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-auto p-6"
      >
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
          <div className="max-w-[400px] rounded-lg border border-[var(--danger-bg)] bg-[var(--danger-bg)] p-4">
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
            // Safe: validateMermaid() rejects dangerous HTML patterns client-side,
            // and mermaid.js securityLevel: "strict" sanitizes SVG output
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
      </div>
    </div>
  );
}
