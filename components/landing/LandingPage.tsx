"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import ConjureLogo from "@/components/ui/ConjureLogo";

const GITHUB_URL = "https://github.com/tttennnnn/conjure";

// ── Product mockup ─────────────────────────────────────────────────────────────

function InfrastructureSVG() {
  return (
    <svg viewBox="0 0 220 195" className="w-full max-w-[210px]" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Edges */}
      <line x1="110" y1="38" x2="65"  y2="78"  stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <line x1="110" y1="38" x2="155" y2="78"  stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <line x1="65"  y1="96" x2="65"  y2="128" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <line x1="155" y1="96" x2="155" y2="128" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <line x1="65"  y1="146" x2="110" y2="160" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <line x1="155" y1="146" x2="110" y2="160" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

      {/* ALB */}
      <rect x="80" y="20" width="60" height="18" rx="4" fill="rgba(59,130,246,0.18)" stroke="rgba(59,130,246,0.45)" strokeWidth="0.75" />
      <text x="110" y="33" textAnchor="middle" fill="rgba(147,197,253,0.85)" fontSize="6.5" fontFamily="monospace">Load Balancer</text>

      {/* API 1 */}
      <rect x="33" y="78" width="64" height="18" rx="4" fill="rgba(99,102,241,0.18)" stroke="rgba(99,102,241,0.45)" strokeWidth="0.75" />
      <text x="65" y="91" textAnchor="middle" fill="rgba(165,180,252,0.85)" fontSize="6.5" fontFamily="monospace">API Server</text>

      {/* API 2 */}
      <rect x="123" y="78" width="64" height="18" rx="4" fill="rgba(99,102,241,0.18)" stroke="rgba(99,102,241,0.45)" strokeWidth="0.75" />
      <text x="155" y="91" textAnchor="middle" fill="rgba(165,180,252,0.85)" fontSize="6.5" fontFamily="monospace">API Server</text>

      {/* Redis */}
      <rect x="33" y="128" width="64" height="18" rx="4" fill="rgba(249,115,22,0.18)" stroke="rgba(249,115,22,0.45)" strokeWidth="0.75" />
      <text x="65" y="141" textAnchor="middle" fill="rgba(253,186,116,0.85)" fontSize="6.5" fontFamily="monospace">Redis Cache</text>

      {/* RDS */}
      <rect x="123" y="128" width="64" height="18" rx="4" fill="rgba(34,197,94,0.18)" stroke="rgba(34,197,94,0.45)" strokeWidth="0.75" />
      <text x="155" y="141" textAnchor="middle" fill="rgba(134,239,172,0.85)" fontSize="6.5" fontFamily="monospace">PostgreSQL</text>
    </svg>
  );
}

function ProductMockup() {
  return (
    <div className="relative w-full max-w-[520px] overflow-hidden rounded-2xl border border-white/10 bg-[#111110] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.65)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-white/[0.07] bg-[#0C0C0B] px-4 py-2.5">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
        </div>
        <div className="mx-auto flex items-center gap-1.5 rounded border border-white/[0.07] bg-white/[0.04] px-3 py-0.5 text-[9px] text-white/20 font-[family-name:var(--font-mono)]">
          conjure.app/session
        </div>
        <div className="w-[52px]" />
      </div>

      {/* Session topbar */}
      <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#0F0F0E] px-3 py-1.5">
        <span className="text-[9.5px] font-semibold text-white/50">AWS Production Stack</span>
        <div className="flex gap-1">
          <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-medium text-amber-300/70">AWS</span>
          <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8px] text-white/25">terraform</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex h-[268px]">
        {/* Chat panel */}
        <div className="flex w-[44%] shrink-0 flex-col gap-2 border-r border-white/[0.07] bg-[#0C0C0B] p-3">
          <div className="flex justify-end">
            <div className="max-w-[90%] rounded-[7px_7px_2px_7px] bg-white/[0.09] px-2 py-1.5 text-[8.5px] leading-relaxed text-white/65">
              Add a Redis cache between the API servers and the database
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="max-w-[90%] rounded-[7px_7px_7px_2px] bg-white/[0.04] px-2 py-1.5 text-[8.5px] leading-relaxed text-white/45">
              Added Redis cache (cache.t3.micro) connected to your API servers on port 6379. Config updated.
            </div>
            <div className="inline-flex items-center gap-1 self-start rounded-[4px] bg-[rgba(83,74,183,0.22)] px-1.5 py-[3px] text-[7.5px] font-medium text-[rgba(167,139,250,0.85)]">
              ↗ diagram updated
            </div>
          </div>
          {/* Input bar */}
          <div className="mt-auto h-7 w-full rounded border border-white/[0.06] bg-white/[0.03]" />
        </div>

        {/* Diagram panel */}
        <div className="flex flex-1 items-center justify-center p-4">
          <InfrastructureSVG />
        </div>
      </div>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────────

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function DiagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="2" />
      <circle cx="5" cy="20" r="2" />
      <circle cx="19" cy="20" r="2" />
      <line x1="12" y1="6" x2="5" y2="18" />
      <line x1="12" y1="6" x2="19" y2="18" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function DeployIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function CheckIcon({ color = "var(--success-text)" }: { color?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 8 6 12 14 4" />
    </svg>
  );
}

// ── Feature icons ───────────────────────────────────────────────────────────────

const FEATURE_ICONS: Record<string, ReactNode> = {
  conversational: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  diagram: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
      <line x1="14" y1="17.5" x2="21" y2="17.5" /><line x1="17.5" y1="14" x2="17.5" y2="21" />
    </svg>
  ),
  truth: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  cloud: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    </svg>
  ),
  terraform: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  ),
  github: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  ),
};

// ── Data ─────────────────────────────────────────────────────────────────────────

interface Step {
  number: string;
  title: string;
  description: string;
  icon: ReactNode;
}

interface Feature {
  key: string;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  {
    number: "01",
    title: "Chat",
    description:
      "Describe your infrastructure in plain English. Or link a GitHub repo with existing Terraform files to reverse-engineer into a diagram.",
    icon: <ChatIcon />,
  },
  {
    number: "02",
    title: "Diagram",
    description:
      "A live Mermaid architecture diagram updates with every message. Click any node to edit its configuration in a properties drawer.",
    icon: <DiagramIcon />,
  },
  {
    number: "03",
    title: "Generate",
    description:
      "Click \"Generate Code\" to produce Terraform HCL — main.tf, variables.tf, outputs.tf — ready to download as a .zip or push to GitHub.",
    icon: <CodeIcon />,
  },
  {
    number: "04",
    title: "Deploy",
    description:
      "Run terraform plan and apply directly from the browser. Target AWS or GCP using saved credential profiles.",
    icon: <DeployIcon />,
  },
];

const FEATURES: Feature[] = [
  {
    key: "conversational",
    title: "Conversational design",
    description:
      "Iterate through chat, not forms. The AI classifies every message and decides what to update.",
  },
  {
    key: "diagram",
    title: "Live architecture diagram",
    description:
      "Mermaid-based, renders in real time as you chat. Click any node to view and edit its config inline.",
  },
  {
    key: "truth",
    title: "Dual source of truth",
    description:
      "Mermaid captures topology. YAML captures everything else — instance sizes, ports, networking. Always in sync.",
  },
  {
    key: "cloud",
    title: "Multi-provider",
    description:
      "AWS and GCP supported. EC2, RDS, ElastiCache, Cloud Run, Cloud SQL, and more.",
  },
  {
    key: "terraform",
    title: "Terraform HCL output",
    description:
      "Syntax-checked before display. Download a ready-to-run .zip or push the generated code to your GitHub repo.",
  },
  {
    key: "github",
    title: "Import existing repos",
    description:
      "Link a GitHub repo with .tf files. Conjure reverse-engineers them into a diagram and config — no starting from scratch.",
  },
];

// ── Main component ──────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <>
      <style>{`
        @keyframes conjure-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .conjure-fade-up {
          animation: conjure-fade-up 0.75s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>

      <div className="min-h-screen bg-[var(--bg)]">

        {/* ── Navbar ─────────────────────────────────────────────────────────── */}
        <header
          className={`fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between px-5 transition-all duration-300 md:px-10 ${
            scrolled
              ? "border-b border-[var(--border)] bg-[var(--surface)]/95 shadow-sm backdrop-blur-sm"
              : "bg-transparent"
          }`}
        >
          <Link href="/" className="flex items-center gap-2">
            <ConjureLogo size={20} />
            <span
              className={`font-[family-name:var(--font-heading)] text-[15px] font-bold tracking-tight transition-colors duration-300 ${
                scrolled ? "text-[var(--text)]" : "text-white"
              }`}
            >
              Conjure
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className={`rounded-[7px] px-3 py-1.5 text-[13px] transition-colors duration-300 ${
                scrolled
                  ? "text-[var(--muted)] hover:text-[var(--text)]"
                  : "text-white/55 hover:text-white"
              }`}
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className={`rounded-[7px] px-3.5 py-1.5 text-[13px] font-medium transition-all duration-300 ${
                scrolled
                  ? "bg-[var(--text)] text-white hover:opacity-90"
                  : "bg-white text-[var(--text)] hover:bg-white/90"
              }`}
            >
              Get started
            </Link>
          </nav>
        </header>

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section
          className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-[var(--text)] px-5 pt-14 md:px-10"
          style={{
            backgroundImage: [
              "radial-gradient(ellipse 65% 55% at 15% 85%, rgba(83,74,183,0.28) 0%, transparent 70%)",
              "radial-gradient(ellipse 55% 45% at 85% 15%, rgba(24,95,165,0.22) 0%, transparent 65%)",
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.018) 1px, transparent 1px)",
            ].join(", "),
            backgroundSize: "100% 100%, 100% 100%, 30px 30px",
          }}
        >
          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-12 py-20 lg:flex-row lg:items-center lg:gap-10 lg:py-16">

            {/* Copy */}
            <div className="flex flex-1 flex-col items-center text-center lg:items-start lg:text-left">
              <div
                className="conjure-fade-up mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 py-1 font-[family-name:var(--font-mono)] text-[10.5px] font-medium uppercase tracking-widest text-white/40"
                style={{ animationDelay: "0ms" }}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400/70" />
                Prompt-to-Infrastructure
              </div>

              <h1
                className="conjure-fade-up font-[family-name:var(--font-heading)] text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]"
                style={{ animationDelay: "80ms" }}
              >
                Describe your cloud.{" "}
                <br className="hidden sm:block" />
                <span className="text-white/35">We generate</span>
                <br />
                <span className="text-white/35">the diagram,</span> the code.
              </h1>

              <p
                className="conjure-fade-up mt-5 max-w-[480px] text-[15px] leading-[1.7] text-white/40"
                style={{ animationDelay: "160ms" }}
              >
                Chat freely about your infrastructure. Conjure builds the
                architecture diagram, writes Terraform HCL, and provisions
                it — all from one conversation.
              </p>

              <div
                className="conjure-fade-up mt-8 flex flex-wrap items-center gap-3"
                style={{ animationDelay: "240ms" }}
              >
                <Link
                  href="/register"
                  className="flex items-center gap-1.5 rounded-[9px] bg-white px-5 py-2.5 text-[13.5px] font-semibold text-[var(--text)] shadow-lg transition-all hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-xl"
                >
                  Get started
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
                <Link
                  href="/login"
                  className="rounded-[9px] border border-white/12 px-5 py-2.5 text-[13.5px] font-medium text-white/50 transition-all hover:border-white/22 hover:text-white/70"
                >
                  Sign in
                </Link>
              </div>

              <p
                className="conjure-fade-up mt-4 text-[11.5px] text-white/22"
                style={{ animationDelay: "320ms" }}
              >
                Free to start — no credit card required.
              </p>
            </div>

            {/* Product mockup */}
            <div
              className="conjure-fade-up w-full max-w-[520px] shrink-0 lg:w-[47%]"
              style={{ animationDelay: "180ms" }}
            >
              <ProductMockup />
            </div>
          </div>

          {/* Bottom fade into light sections */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--bg)] to-transparent" />
        </section>

        {/* ── Section 01: How it works ──────────────────────────────────────── */}
        <section className="bg-[var(--bg)] px-5 pb-24 pt-20 md:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10">
              <p className="font-[family-name:var(--font-mono)] text-[10.5px] font-medium uppercase tracking-widest text-[var(--hint)]">
                01 / How it works
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-[var(--text)] md:text-[2.25rem]">
                From conversation to cloud
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <div
                  key={step.number}
                  className="group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all duration-200 hover:border-[var(--border2)] hover:shadow-md"
                >
                  {/* Background watermark number */}
                  <div className="pointer-events-none absolute -right-1 -top-2 select-none font-[family-name:var(--font-heading)] text-[84px] font-bold leading-none text-[var(--text)] opacity-[0.04]">
                    {step.number}
                  </div>

                  <div className="relative">
                    <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface2)] text-[var(--muted)] transition-colors duration-200 group-hover:bg-[var(--purple-bg)] group-hover:text-[var(--purple-text)]">
                      {step.icon}
                    </div>
                    <h3 className="mb-1.5 text-[14.5px] font-semibold text-[var(--text)]">
                      {step.title}
                    </h3>
                    <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 02: Features ──────────────────────────────────────────── */}
        <section className="bg-[var(--bg)] px-5 pb-24 md:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10">
              <p className="font-[family-name:var(--font-mono)] text-[10.5px] font-medium uppercase tracking-widest text-[var(--hint)]">
                02 / What you get
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-[var(--text)] md:text-[2.25rem]">
                Everything in one conversation
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.key}
                  className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all duration-200 hover:border-[var(--border2)] hover:shadow-sm"
                >
                  <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface2)] text-[var(--muted)] transition-colors duration-200 group-hover:bg-[var(--purple-bg)] group-hover:text-[var(--purple-text)]">
                    {FEATURE_ICONS[feature.key]}
                  </div>
                  <h3 className="mb-1.5 text-[14px] font-semibold text-[var(--text)]">
                    {feature.title}
                  </h3>
                  <p className="text-[12.5px] leading-relaxed text-[var(--muted)]">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 03: Pricing ───────────────────────────────────────────── */}
        <section className="bg-[var(--surface)] px-5 py-24 md:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10">
              <p className="font-[family-name:var(--font-mono)] text-[10.5px] font-medium uppercase tracking-widest text-[var(--hint)]">
                03 / Pricing
              </p>
              <h2 className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-[var(--text)] md:text-[2.25rem]">
                Free to start. No credit card.
              </h2>
              <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-[var(--muted)]">
                All sessions run on free LLM models via OpenRouter out of the
                box. Add your Anthropic key in Settings to unlock Claude models.
              </p>
            </div>

            <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Free tier */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6">
                <p className="font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-widest text-[var(--hint)]">
                  Free
                </p>
                <p className="mt-1.5 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--text)]">
                  $0
                </p>
                <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">No API key needed</p>

                <ul className="mt-5 space-y-2.5">
                  {[
                    "Free LLM models via OpenRouter",
                    "Unlimited sessions",
                    "AWS & GCP support",
                    "Terraform HCL generation",
                    "Plan & apply from browser",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-[12.5px] text-[var(--muted)]">
                      <CheckIcon />
                      {item}
                    </li>
                  ))}
                </ul>

              </div>

              {/* BYOK tier */}
              <div className="relative rounded-xl border border-[var(--purple-text)]/25 bg-[var(--purple-bg)] p-6">
                <div className="absolute right-4 top-4">
                  <span className="rounded-full bg-[var(--purple-text)] px-2.5 py-0.5 text-[9.5px] font-semibold text-white">
                    Premium
                  </span>
                </div>
                <p className="font-[family-name:var(--font-mono)] text-[10px] font-medium uppercase tracking-widest text-[var(--purple-text)]/55">
                  BYOK
                </p>
                <p className="mt-1.5 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--text)]">
                  Your key
                </p>
                <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Anthropic API key</p>

                <ul className="mt-5 space-y-2.5">
                  {[
                    "Everything in Free",
                    "Claude Haiku 4.5",
                    "Claude Sonnet 4.6",
                    "Claude Opus 4.6",
                    "Higher quality outputs",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-[12.5px] text-[var(--muted)]">
                      <CheckIcon color="var(--purple-text)" />
                      {item}
                    </li>
                  ))}
                </ul>

              </div>
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ──────────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden bg-[var(--text)] px-5 py-28 text-center md:px-10"
          style={{
            backgroundImage: [
              "radial-gradient(ellipse 65% 60% at 25% 75%, rgba(83,74,183,0.24) 0%, transparent 70%)",
              "radial-gradient(ellipse 55% 50% at 78% 22%, rgba(24,95,165,0.19) 0%, transparent 65%)",
            ].join(", "),
          }}
        >
          <div className="relative z-10 mx-auto max-w-2xl">
            <p className="font-[family-name:var(--font-mono)] text-[10.5px] font-medium uppercase tracking-widest text-white/25">
              Ready?
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
              Start building your infrastructure
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-white/35">
              Free models, no credit card, no lock-in.
              <br />
              Just describe your cloud.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="flex items-center gap-1.5 rounded-[10px] bg-white px-6 py-3 text-[14px] font-semibold text-[var(--text)] shadow-lg transition-all hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-xl"
              >
                Get started
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-[10px] border border-white/12 px-6 py-3 text-[14px] font-medium text-white/45 transition-all hover:border-white/22 hover:text-white/65"
              >
                {FEATURE_ICONS.github}
                View source
              </a>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <footer className="border-t border-white/[0.06] bg-[var(--text)] px-5 py-5 md:px-10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-2">
              <ConjureLogo size={15} />
              <span className="text-[11.5px] text-white/25">
                © 2026 Conjure — Prompt-to-Infrastructure
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11.5px] text-white/22 transition-colors hover:text-white/45"
              >
                GitHub
              </a>
              <Link href="/login" className="text-[11.5px] text-white/22 transition-colors hover:text-white/45">
                Sign in
              </Link>
              <Link href="/register" className="text-[11.5px] text-white/22 transition-colors hover:text-white/45">
                Get started
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
