import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[var(--surface2)]">
      <div className="flex h-14 w-14 items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--surface)] text-[22px] text-[var(--hint)]">
        ⬡
      </div>
      <h2 className="text-sm font-semibold">No session selected</h2>
      <p className="max-w-[300px] text-center text-xs leading-relaxed text-[var(--muted)]">
        Start a new session to describe your infrastructure and generate
        architecture diagrams and IaC code.
      </p>
      <Link
        href="/session/new"
        className="mt-1 rounded-[var(--radius)] bg-[var(--text)] px-5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
      >
        + New session
      </Link>
    </div>
  );
}
