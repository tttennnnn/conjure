import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";

function getInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

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
      : user.email ?? "User";

  const initials = getInitials(displayName);

  return (
    <div className="flex h-full">
      <Sidebar
        displayName={displayName}
        initials={initials}
      />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
