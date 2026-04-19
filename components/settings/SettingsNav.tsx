"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/settings/api-keys", label: "API Keys" },
  { href: "/settings/credentials", label: "Credentials" },
  { href: "/settings/github", label: "GitHub" },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex gap-1 border-b border-[var(--border)]">
      {NAV_ITEMS.map(({ href, label }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-[var(--text)] text-[var(--text)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
