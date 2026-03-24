import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/auth/SignOutButton";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const displayName =
    user.user_metadata?.first_name
      ? `${user.user_metadata.first_name} ${user.user_metadata.last_name ?? ""}`.trim()
      : user.email;

  return (
    <div className="flex h-full">
      <aside className="flex w-64 flex-col border-r border-[var(--border)]">
        <div className="flex-1 p-4">
          {/* Sidebar — session list */}
        </div>
        <div className="border-t border-[var(--border)] p-4">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-[var(--muted)]">{user.email}</p>
          <div className="mt-2 flex items-center gap-3">
            <Link
              href="/settings/api-keys"
              className="text-sm text-[var(--muted)] hover:text-[var(--text)]"
            >
              Settings
            </Link>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
