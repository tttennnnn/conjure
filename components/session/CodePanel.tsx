"use client";

import { useState } from "react";

export interface TerraformFiles {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
}

interface CodePanelProps {
  terraformCode: TerraformFiles;
  isStale: boolean;
  iacTool: string;
}

type FileKey = "mainTf" | "variablesTf" | "outputsTf";

const FILE_TABS: { key: FileKey; label: string }[] = [
  { key: "mainTf", label: "main.tf" },
  { key: "variablesTf", label: "variables.tf" },
  { key: "outputsTf", label: "outputs.tf" },
];

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadZip(files: TerraformFiles) {
  // Build a minimal ZIP archive without external dependencies.
  // Uses the browser's CompressionStream (supported in all modern browsers).
  // Falls back to downloading files individually if CompressionStream is unavailable.
  const entries: { name: string; content: string }[] = [
    { name: "main.tf", content: files.mainTf },
    { name: "variables.tf", content: files.variablesTf },
    { name: "outputs.tf", content: files.outputsTf },
  ];

  if (typeof CompressionStream === "undefined") {
    // Fallback: individual downloads
    for (const entry of entries) {
      downloadTextFile(entry.name, entry.content);
    }
    return;
  }

  // Build a ZIP using raw ZIP format (no compression, stored method)
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  function u16(n: number): Uint8Array {
    return new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
  }
  function u32(n: number): Uint8Array {
    return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);
  }
  function concat(...arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const a of arrays) { out.set(a, pos); pos += a.length; }
    return out;
  }

  for (const entry of entries) {
    const data = encoder.encode(entry.content);
    const name = encoder.encode(entry.name);
    const crc = crc32(data);

    // Local file header
    const localHeader = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // signature
      u16(20),           // version needed
      u16(0),            // flags
      u16(0),            // compression: stored
      u16(0), u16(0),    // mod time, mod date
      u32(crc),
      u32(data.length),  // compressed size
      u32(data.length),  // uncompressed size
      u16(name.length),
      u16(0),            // extra field length
      name,
    );

    parts.push(localHeader, data);

    // Central directory entry
    const cdEntry = concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), // signature
      u16(20), u16(20),  // version made by, version needed
      u16(0),            // flags
      u16(0),            // compression: stored
      u16(0), u16(0),    // mod time, mod date
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(name.length),
      u16(0), u16(0),    // extra, comment
      u16(0), u16(0),    // disk start, int attr
      u32(0),            // ext attr
      u32(offset),       // local header offset
      name,
    );
    centralDir.push(cdEntry);
    offset += localHeader.length + data.length;
  }

  const cdSize = centralDir.reduce((s, e) => s + e.length, 0);
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]), // signature
    u16(0), u16(0),        // disk number, disk with CD
    u16(entries.length), u16(entries.length),
    u32(cdSize),
    u32(offset),
    u16(0),                // comment length
  );

  const zipBytes = concat(...parts, ...centralDir, eocd);
  // Slice to get a plain ArrayBuffer (avoids SharedArrayBuffer type mismatch in Blob constructor)
  const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer;
  const blob = new Blob([zipBuffer], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "terraform.zip";
  a.click();
  URL.revokeObjectURL(url);
}

// CRC-32 implementation for ZIP checksums
function crc32(data: Uint8Array): number {
  const table = makeCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] ?? 0;
    const idx = (crc ^ byte) & 0xff;
    crc = (crc >>> 8) ^ (table[idx] ?? 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

let _crcTable: number[] | null = null;
function makeCrcTable(): number[] {
  if (_crcTable) return _crcTable;
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t.push(c);
  }
  _crcTable = t;
  return _crcTable;
}

export default function CodePanel({ terraformCode, isStale, iacTool }: CodePanelProps) {
  const [activeFile, setActiveFile] = useState<FileKey>("mainTf");
  const [copied, setCopied] = useState(false);

  const activeContent = terraformCode[activeFile];

  function handleCopy() {
    navigator.clipboard.writeText(activeContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleDownloadZip() {
    downloadZip(terraformCode);
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
            className="rounded px-2 py-0.5 text-[10px] text-[var(--muted)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors"
          >
            {copied ? "Copied" : "Copy"}
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
        <div className="shrink-0 border-b border-[var(--warning-border,#f59e0b)] bg-[var(--warning-bg,#fef3c7)] px-4 py-2 text-[11px] text-[var(--warning-text,#92400e)]">
          Diagram or config has changed — regenerate to update code.
        </div>
      )}

      {/* Code display */}
      <div className="flex flex-1 overflow-auto">
        <pre className="flex-1 p-4 text-[11px] leading-relaxed text-[var(--text)] font-[JetBrains_Mono,monospace] whitespace-pre">
          {activeContent || <span className="text-[var(--muted)]"># (empty)</span>}
        </pre>
      </div>
    </div>
  );
}
