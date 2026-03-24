export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full">
      {/* Left panel — branding (desktop only) */}
      <div className="relative hidden flex-1 flex-col justify-center overflow-hidden bg-[var(--text)] px-10 py-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 80%, rgba(83,74,183,0.25) 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, rgba(24,95,165,0.2) 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-md">
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-bold tracking-tight">Conjure</h1>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Describe your infrastructure in plain English. Get a diagram,
            Terraform code, and deploy — all from one conversation.
          </p>
          <div className="mt-8 space-y-4 text-sm text-white/50">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg">💬</span>
              <span>Chat naturally — the AI builds your architecture as you talk</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg">📐</span>
              <span>Live diagrams that update with every message</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg">🚀</span>
              <span>Generate Terraform and deploy from the browser</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — auth form */}
      <div className="flex w-full shrink-0 flex-col bg-[var(--surface)] lg:w-[400px] lg:justify-center">
        {/* Mobile header — dark strip matching desktop branding */}
        <div className="relative overflow-hidden bg-[var(--text)] px-7 pb-7 pt-10 text-white sm:px-9 lg:hidden">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 20% 80%, rgba(83,74,183,0.3) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(24,95,165,0.25) 0%, transparent 50%)",
            }}
          />
          <div className="relative">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight">Conjure</h1>
            <p className="mt-1 text-sm text-white/50">Prompt-to-Infrastructure</p>
          </div>
        </div>
        <div className="px-7 pb-10 pt-8 sm:px-9 lg:py-10">
          <div className="w-full max-w-[328px] lg:mx-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
