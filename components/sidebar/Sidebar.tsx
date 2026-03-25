"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ConjureLogo from "@/components/ui/ConjureLogo";

interface SidebarProps {
  displayName: string;
  initials: string;
}

const SIDEBAR_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

function AccountMenu({ onLogout, onClose }: { onLogout: () => void; onClose: () => void }) {
  return (
    <div className="absolute bottom-full left-2 mb-1 w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
      <Link
        href="/settings/api-keys"
        onClick={onClose}
        className="flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--text)] transition-colors hover:bg-[var(--surface2)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        Settings
      </Link>
      <div className="mx-2 my-1 h-px bg-[var(--border)]" />
      <button
        onClick={onLogout}
        className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-[var(--danger-text)] transition-colors hover:bg-[var(--surface2)]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Sign out
      </button>
    </div>
  );
}

const EXPANDED_WIDTH = 210;
const COLLAPSED_WIDTH = 48;
const DURATION = 200;

export default function Sidebar({ displayName, initials }: SidebarProps) {
  const router = useRouter();
  // collapsed: drives the CSS width (animated)
  // showExpanded: drives which content layout is rendered (delayed on collapse)
  const [collapsed, setCollapsed] = useState(false);
  const [showExpanded, setShowExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  function handleCollapse() {
    // 1) Start fading text + shrinking width simultaneously
    setCollapsed(true);
    // 2) After width animation finishes, swap to collapsed layout
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowExpanded(false), DURATION);
  }

  function handleExpand() {
    // 1) Swap to expanded layout immediately (text starts invisible)
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowExpanded(true);
    // 2) Grow width (text fades in via CSS transition)
    requestAnimationFrame(() => setCollapsed(false));
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Text fades out when collapsed, fades in when expanded
  const textFade = collapsed
    ? "opacity-0 transition-opacity duration-150"
    : "opacity-100 transition-opacity duration-150 delay-75";

  if (!showExpanded) {
    // ── Collapsed layout (clean icon-only) ──
    return (
      <aside
        className="relative z-10 flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200 ease-in-out"
        style={{ width: COLLAPSED_WIDTH }}
      >
        <div className="flex items-center justify-center py-2" style={{ minHeight: 44 }}>
          <button
            onClick={handleExpand}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-[5px] border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
            title="Expand sidebar"
          >
            {SIDEBAR_ICON}
          </button>
        </div>

        <div className="flex justify-center px-2.5 py-2">
          <Link
            href="/session/new"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--text)] text-xs text-white"
            title="New session"
          >
            +
          </Link>
        </div>

        <div className="flex-1" />

        <div className="relative" ref={menuRef}>
          {menuOpen && (
            <AccountMenu onLogout={handleLogout} onClose={() => setMenuOpen(false)} />
          )}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex w-full items-center justify-center py-3.5 transition-colors hover:bg-[var(--surface2)]"
            title={displayName}
          >
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--info-bg)] text-[9px] font-semibold text-[var(--info-text)]">
              {initials}
            </div>
          </button>
        </div>
      </aside>
    );
  }

  // ── Expanded layout (full content with fade transitions) ──
  return (
    <aside
      className="relative z-10 flex shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200 ease-in-out"
      style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
    >
        {/* Header */}
        <div className="flex items-center px-2.5 py-2" style={{ minHeight: 44 }}>
          <Link href="/home" className={`flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap ${textFade}`}>
            <ConjureLogo size={18} />
            <span>Conjure</span>
          </Link>
          <div className="flex-1" />
          <button
            onClick={handleCollapse}
            className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[5px] border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)] ${textFade}`}
            title="Collapse sidebar"
          >
            {SIDEBAR_ICON}
          </button>
        </div>

        {/* New session button */}
        <div className="px-2.5 py-2">
          <Link
            href="/session/new"
            className="flex h-7 items-center rounded-md bg-[var(--text)] text-[11px] font-medium text-white transition-opacity hover:opacity-90"
            title="New session"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center text-xs">+</span>
            <span className={`whitespace-nowrap pr-2 ${textFade}`}>New session</span>
          </Link>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-1.5">
          <div className={`px-2 py-6 text-center text-[11px] leading-relaxed text-[var(--hint)] ${textFade}`}>
            No sessions yet.
            <br />
            Create one to get started.
          </div>
        </div>

        {/* Bottom: account */}
        <div className="relative" ref={menuRef}>
          {menuOpen && (
            <AccountMenu onLogout={handleLogout} onClose={() => setMenuOpen(false)} />
          )}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex w-full items-center py-3.5 transition-colors hover:bg-[var(--surface2)]"
            title={displayName}
          >
            <div className="flex w-[48px] shrink-0 items-center justify-center">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--info-bg)] text-[9px] font-semibold text-[var(--info-text)]">
                {initials}
              </div>
            </div>
            <span className={`flex-1 truncate text-left text-[11px] font-medium whitespace-nowrap ${textFade}`}>{displayName}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`shrink-0 text-[var(--muted)] ${textFade}`}>
              <path d="M7 15l5-5 5 5" />
            </svg>
          </button>
        </div>
    </aside>
  );
}
