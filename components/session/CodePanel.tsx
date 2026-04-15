"use client";

import { useState, useMemo } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-hcl";
import { downloadAsZip } from "@/lib/utils/zip";

export interface IacFiles {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
}

interface CodePanelProps {
  iacCode: IacFiles;
  isStale: boolean;
  iacTool: string;
}

type FileKey = "mainTf" | "variablesTf" | "outputsTf";

const FILE_TABS: { key: FileKey; label: string }[] = [
  { key: "mainTf", label: "main.tf" },
  { key: "variablesTf", label: "variables.tf" },
  { key: "outputsTf", label: "outputs.tf" },
];

type PrismToken = string | Prism.Token;

function renderTokens(tokens: PrismToken[]): React.ReactNode[] {
  return tokens.map((token, i) => {
    if (typeof token === "string") return token;
    const type = Array.isArray(token.type) ? token.type.join(" ") : token.type;
    const children = Array.isArray(token.content)
      ? renderTokens(token.content as PrismToken[])
      : typeof token.content === "string"
        ? token.content
        : renderTokens([token.content as PrismToken]);
    return <span key={i} className={`token ${type}`}>{children}</span>;
  });
}

export default function CodePanel({ iacCode, isStale, iacTool }: CodePanelProps) {
  const [activeFile, setActiveFile] = useState<FileKey>("mainTf");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const activeContent = iacCode[activeFile];

  const highlightedNodes = useMemo(() => {
    if (!activeContent) return null;
    const tokens = Prism.tokenize(activeContent, Prism.languages["hcl"]!);
    return renderTokens(tokens);
  }, [activeContent]);

  function handleCopy() {
    navigator.clipboard.writeText(activeContent)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        setCopyFailed(true);
        setTimeout(() => setCopyFailed(false), 1500);
      });
  }

  function handleDownloadZip() {
    downloadAsZip(
      [
        { name: "main.tf", content: iacCode.mainTf },
        { name: "variables.tf", content: iacCode.variablesTf },
        { name: "outputs.tf", content: iacCode.outputsTf },
      ],
      "terraform.zip",
    );
  }

  return (
    <div className="flex flex-1 flex-col min-w-0 bg-[var(--bg)]">
      {/* Tab bar */}
      <div className="flex h-[38px] shrink-0 items-end justify-between border-b border-[var(--border)] bg-[var(--surface)] px-2.5">
        <div className="flex items-end gap-0.5">
          {FILE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFile(tab.key)}
              className={[
                "flex h-[30px] items-center rounded-t-md border border-b-0 px-3 text-[10px] font-medium transition-colors",
                activeFile === tab.key
                  ? "border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--text)]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 pb-1">
          <span className="rounded border border-[var(--border)] bg-[var(--surface2)] px-1.5 py-0.5 text-[10px] capitalize text-[var(--muted)]">
            {iacTool}
          </span>
          <button
            onClick={handleCopy}
            className={`rounded px-2 py-0.5 text-[10px] transition-colors ${
              copyFailed
                ? "text-[var(--danger-text)]"
                : "text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
            }`}
          >
            {copied ? "Copied" : copyFailed ? "Copy failed" : "Copy"}
          </button>
          <button
            onClick={handleDownloadZip}
            className="rounded px-2 py-0.5 text-[10px] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors"
          >
            Download .zip
          </button>
        </div>
      </div>

      {/* Stale banner */}
      {isStale && (
        <div className="shrink-0 border-b border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-2 text-[11px] text-[var(--warning-text)]">
          Diagram or config has changed — regenerate to update code.
        </div>
      )}

      {/* Code display */}
      <div className="flex flex-1 overflow-auto">
        <pre className="flex-1 p-4 text-[11px] leading-relaxed font-[family-name:var(--font-mono)] whitespace-pre">
          {highlightedNodes ?? <span className="text-[var(--muted)]"># (empty)</span>}
        </pre>
      </div>
    </div>
  );
}
