export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-full">
      <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800">
        {/* Sidebar — session list */}
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
