"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface SessionTopbarProps {
  sessionId: string;
  initialName: string;
  targetEnv: string;
  model: string;
  iacTool: string;
  githubRepo?: string;
}

export default function SessionTopbar({
  sessionId,
  initialName,
  targetEnv,
  model,
  iacTool,
  githubRepo,
}: SessionTopbarProps) {
  const [sessionName, setSessionName] = useState(initialName);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState(sessionName);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onRenamed(e: CustomEvent<{ id: string; name: string }>) {
      if (e.detail.id === sessionId) setSessionName(e.detail.name);
    }
    window.addEventListener("session-renamed", onRenamed as EventListener);
    return () => window.removeEventListener("session-renamed", onRenamed as EventListener);
  }, [sessionId]);

  const startRenaming = useCallback(() => {
    setRenameDraft(sessionName);
    setIsRenaming(true);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }, [sessionName]);

  const commitRename = useCallback(async () => {
    setIsRenaming(false);
    const trimmed = renameDraft.trim();
    if (!trimmed || trimmed === sessionName) return;

    const previousName = sessionName;
    setSessionName(trimmed);
    window.dispatchEvent(
      new CustomEvent("session-renamed", { detail: { id: sessionId, name: trimmed } }),
    );

    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSessionName(previousName);
      window.dispatchEvent(
        new CustomEvent("session-renamed", { detail: { id: sessionId, name: previousName } }),
      );
    }
  }, [renameDraft, sessionName, sessionId]);

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3.5">
      <div className="flex items-center gap-1.5">
        {isRenaming ? (
          <>
            <input
              ref={renameInputRef}
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") setIsRenaming(false);
              }}
              className="h-6 w-48 rounded border border-[var(--border)] bg-[var(--surface2)] px-1.5 text-xs font-semibold outline-none focus:border-[var(--text)]"
              maxLength={100}
            />
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={commitRename}
              className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
              title="Save"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2 8 6 12 14 4" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <span className="text-xs font-semibold">{sessionName}</span>
            <button
              onClick={startRenaming}
              className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
              title="Rename session"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
              </svg>
            </button>
          </>
        )}
      </div>
      <div className="flex gap-1.5">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
          targetEnv.toLowerCase() === "aws"
            ? "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning-text)]"
            : "border-[var(--info-text)]/25 bg-[var(--info-bg)] text-[var(--info-text)]"
        }`}>
          {targetEnv.toUpperCase()}
        </span>
        <span className="max-w-[120px] truncate rounded border border-[var(--border)] bg-[var(--surface2)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
          {model}
        </span>
        <span className="rounded border border-[var(--border)] bg-[var(--surface2)] px-1.5 py-0.5 text-[10px] capitalize text-[var(--muted)]">
          {iacTool}
        </span>
        {githubRepo && (
          <span className="rounded border border-[var(--border)] bg-[var(--surface2)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
            {githubRepo}
          </span>
        )}
      </div>
    </div>
  );
}
