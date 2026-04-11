"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import ConjureLogo from "@/components/ui/ConjureLogo";
import { groupByDate, relativeTime } from "@/lib/utils/date-groups";

interface SessionItem {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

function SessionRow({
  s,
  isActive,
  onDelete,
}: {
  s: SessionItem;
  isActive: boolean;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this session? This cannot be undone.")) return;
    try {
      await fetch(`/api/sessions/${s.id}`, { method: "DELETE" });
      onDelete(s.id);
    } catch {
      // Silently fail
    }
  }

  return (
    <Link
      href={`/session/${s.id}`}
      className={`group mb-px flex flex-col gap-0.5 rounded-md px-[7px] py-1.5 transition-colors ${
        isActive ? "bg-[var(--surface2)]" : "hover:bg-[var(--surface2)]"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1 truncate text-[11px] font-medium">
          {s.name}
        </div>
        {hovered && (
          <button
            onClick={handleDelete}
            className="shrink-0 rounded p-px text-[var(--hint)] transition-colors hover:text-[var(--danger-text)]"
            title="Delete session"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span className={`rounded-[3px] px-1.5 py-px text-[9px] font-medium capitalize ${STATUS_PILL[s.status] ?? STATUS_PILL.active}`}>
          {s.status}
        </span>
        <span className="text-[9px] text-[var(--hint)]">{relativeTime(s.createdAt)}</span>
      </div>
    </Link>
  );
}

interface SidebarProps {
  displayName: string;
  avatarUrl: string | null;
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

const STATUS_PILL: Record<string, string> = {
  active: "bg-[var(--info-bg)] text-[var(--info-text)]",
  deployed: "bg-[var(--success-bg)] text-[var(--success-text)]",
  failed: "bg-[var(--danger-bg)] text-[var(--danger-text)]",
};

export default function Sidebar({ displayName, avatarUrl }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [showExpanded, setShowExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        setSessions(await res.json());
      }
    } catch {
      // Silently fail -- sidebar still works
    }
  }, []);

  async function handleDelete(id: string) {
    if (pathname === `/session/${id}`) {
      // Update sidebar first so it reflects the deletion before navigation clears the main panel.
      await fetchSessions();
      router.push("/home");
    } else {
      fetchSessions();
    }
  }

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, pathname]);

  // Sync sidebar when session is renamed from topbar
  useEffect(() => {
    function onRenamed(e: CustomEvent<{ id: string; name: string }>) {
      setSessions((prev) => prev.map((s) => (s.id === e.detail.id ? { ...s, name: e.detail.name } : s)));
    }
    window.addEventListener("session-renamed", onRenamed as EventListener);
    return () => window.removeEventListener("session-renamed", onRenamed as EventListener);
  }, []);

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
    // 2) After width animation finishes, hide expanded content
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowExpanded(false), DURATION);
  }

  function handleExpand() {
    // 1) Restore expanded content immediately (text starts invisible)
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

  // Single layout — both expanded and collapsed states share one DOM tree.
  // The toggle button uses position:absolute so it is completely independent of
  // the flex layout and never moves or blinks during the width transition.
  return (
    <aside
      className="relative z-10 flex shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200 ease-in-out"
      style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
    >
      {/* Header: relative container so the toggle button can be absolutely positioned */}
      <div className="relative" style={{ minHeight: 44 }}>
        {showExpanded && (
          <Link
            href="/home"
            className={`absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap ${textFade}`}
          >
            <ConjureLogo size={18} />
            <span>Conjure</span>
          </Link>
        )}
        {/* Absolutely positioned — immune to flex layout shifts, never blinks */}
        <button
          onClick={showExpanded ? handleCollapse : handleExpand}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-[22px] w-[22px] items-center justify-center rounded-[5px] border border-[var(--border)] text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
          title={showExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {SIDEBAR_ICON}
        </button>
      </div>

      {/* New session button */}
      <div className={`py-2 ${showExpanded ? "px-2.5" : "flex justify-center px-2.5"}`}>
        {showExpanded ? (
          <Link
            href="/session/new"
            className="flex h-7 items-center rounded-md bg-[var(--text)] text-[11px] font-medium text-white transition-opacity hover:opacity-90"
            title="New session"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center text-xs">+</span>
            <span className={`whitespace-nowrap pr-2 ${textFade}`}>New session</span>
          </Link>
        ) : (
          <Link
            href="/session/new"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--text)] text-xs text-white"
            title="New session"
          >
            +
          </Link>
        )}
      </div>

      {/* Session list */}
      {showExpanded ? (
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-1.5">
          {sessions.length === 0 ? (
            <div className={`px-2 py-6 text-center text-[11px] leading-relaxed text-[var(--hint)] ${textFade}`}>
              No sessions yet.
              <br />
              Create one to get started.
            </div>
          ) : (
            <div className={textFade}>
              {groupByDate(sessions).map((group) => (
                <div key={group.label}>
                  <div className="px-1.5 pt-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--hint)]">
                    {group.label}
                  </div>
                  {group.items.map((s) => (
                    <SessionRow
                      key={s.id}
                      s={s}
                      isActive={pathname === `/session/${s.id}`}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1" />
      )}

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
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--info-bg)] text-[9px] font-semibold text-[var(--info-text)]">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          {showExpanded && (
            <>
              <span className={`flex-1 truncate text-left text-[11px] font-medium whitespace-nowrap ${textFade}`}>{displayName}</span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`mr-3 shrink-0 text-[var(--hint)] transition-transform duration-150 ${menuOpen ? "rotate-180" : ""} ${textFade}`}
              >
                <polyline points="4 10 8 6 12 10" />
              </svg>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
