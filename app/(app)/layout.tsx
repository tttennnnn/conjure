import { createClient } from "@/lib/supabase/server";
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
      <aside className="flex w-64 flex-col border-r border-zinc-200">
        <div className="flex-1 p-4">
          {/* Sidebar — session list */}
        </div>
        <div className="border-t border-zinc-200 p-4">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-zinc-500">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
