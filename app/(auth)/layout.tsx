import AuthBrandingPanel from "@/components/auth/AuthBrandingPanel";
import ConjureLogo from "@/components/ui/ConjureLogo";
import { ChatIcon, DiagramIcon, DeployIcon } from "@/components/ui/icons";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-full">
      {/* Left panel -- branding (desktop only) */}
      <AuthBrandingPanel>
        <div className="conjure-fade-up flex items-center gap-3" style={{ animationDelay: "0ms" }}>
          <ConjureLogo size={36} />
          <h1 className="font-[family-name:var(--font-heading)] text-4xl font-bold tracking-tight">Conjure</h1>
        </div>
        <p className="conjure-fade-up mt-4 text-base leading-relaxed text-white/60" style={{ animationDelay: "80ms" }}>
          Describe your infrastructure in plain English. Get a diagram,
          IaC code, and deploy — all from one conversation.
        </p>
        <div className="conjure-fade-up mt-8 space-y-4 text-sm text-white/50" style={{ animationDelay: "160ms" }}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-white/40"><ChatIcon size={15} /></span>
            <span>Chat naturally — the AI builds your architecture as you talk</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-white/40"><DiagramIcon size={15} /></span>
            <span>Live diagrams that update with every message</span>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0 text-white/40"><DeployIcon size={15} /></span>
            <span>Generate IaC and deploy from the browser</span>
          </div>
        </div>
      </AuthBrandingPanel>

      {/* Right panel -- auth form */}
      <div className="flex w-full shrink-0 flex-col bg-[var(--surface)] lg:w-[440px] lg:justify-center xl:w-[480px]">
        {/* Mobile header -- dark strip matching desktop branding */}
        <div className="relative overflow-hidden bg-[var(--text)] px-7 pb-7 pt-10 text-white sm:px-9 lg:hidden">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 20% 80%, rgba(83,74,183,0.3) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(24,95,165,0.25) 0%, transparent 50%)",
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <ConjureLogo size={24} />
              <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight">Conjure</h1>
            </div>
            <p className="mt-1 text-sm text-white/50">Prompt-to-Infrastructure</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center px-7 pb-10 pt-8 sm:px-9 lg:flex-none lg:py-10">
          <div className="w-full max-w-[360px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
