export default function SessionLoading() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Topbar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3.5">
        <div className="h-2.5 w-28 animate-pulse rounded bg-[var(--surface2)]" />
        <div className="flex gap-1.5">
          <div className="h-4 w-9 animate-pulse rounded border border-[var(--border)] bg-[var(--surface2)]" />
          <div className="h-4 w-20 animate-pulse rounded border border-[var(--border)] bg-[var(--surface2)]" />
          <div className="h-4 w-14 animate-pulse rounded border border-[var(--border)] bg-[var(--surface2)]" />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Chat column */}
        <div className="flex w-[280px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
          <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3">
            <div className="flex flex-col gap-1.5 items-start">
              <div className="h-2 w-12 animate-pulse rounded bg-[var(--surface2)]" />
              <div className="h-10 w-44 animate-pulse rounded-[2px_10px_10px_10px] bg-[var(--surface2)]" />
            </div>
            <div className="flex flex-col gap-1.5 items-end">
              <div className="h-2 w-8 animate-pulse rounded bg-[var(--surface2)]" />
              <div className="h-7 w-32 animate-pulse rounded-[10px_10px_2px_10px] bg-[var(--surface2)]" />
            </div>
            <div className="flex flex-col gap-1.5 items-start">
              <div className="h-2 w-12 animate-pulse rounded bg-[var(--surface2)]" />
              <div className="h-16 w-48 animate-pulse rounded-[2px_10px_10px_10px] bg-[var(--surface2)]" />
            </div>
            <div className="flex flex-col gap-1.5 items-end">
              <div className="h-2 w-8 animate-pulse rounded bg-[var(--surface2)]" />
              <div className="h-7 w-24 animate-pulse rounded-[10px_10px_2px_10px] bg-[var(--surface2)]" />
            </div>
            <div className="flex flex-col gap-1.5 items-start">
              <div className="h-2 w-12 animate-pulse rounded bg-[var(--surface2)]" />
              <div className="h-12 w-40 animate-pulse rounded-[2px_10px_10px_10px] bg-[var(--surface2)]" />
            </div>
          </div>
          {/* Chat input */}
          <div className="shrink-0 border-t border-[var(--border)] px-2.5 py-2">
            <div className="h-8 animate-pulse rounded-[7px] border border-[var(--border)] bg-[var(--surface2)]" />
          </div>
        </div>

        {/* Diagram panel */}
        <div className="flex flex-1 flex-col bg-[var(--surface)]">
          {/* Tab bar */}
          <div className="flex h-9 shrink-0 items-center gap-3 border-b border-[var(--border)] px-3">
            <div className="h-2.5 w-12 animate-pulse rounded bg-[var(--surface2)]" />
          </div>
          {/* Diagram area */}
          <div className="flex flex-1 items-center justify-center">
            <div className="h-48 w-64 animate-pulse rounded-lg bg-[var(--surface2)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
