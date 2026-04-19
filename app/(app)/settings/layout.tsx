import SettingsNav from "@/components/settings/SettingsNav";

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight">
        Settings
      </h1>
      <SettingsNav />
      <div className="mt-8">{children}</div>
    </div>
  );
}
