import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";

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
    (typeof user.user_metadata?.username === "string" && user.user_metadata.username) ||
    (typeof user.user_metadata?.user_name === "string" && user.user_metadata.user_name) ||
    user.email ||
    "User";

  const avatarUrl =
    (typeof user.user_metadata?.avatar_url === "string" && user.user_metadata.avatar_url) || null;

  return (
    <div className="flex h-full">
      <Sidebar
        displayName={displayName}
        avatarUrl={avatarUrl}
      />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
