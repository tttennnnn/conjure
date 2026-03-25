"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  type ModelOption,
  getAvailableModels,
} from "@/lib/sessions/validation";

const ENV_OPTIONS = [
  { id: "aws" as const, name: "AWS", sub: "EC2, RDS, ElastiCache, VPC\u2026" },
  { id: "gcp" as const, name: "GCP", sub: "Cloud Run, Cloud SQL\u2026" },
];

const IAC_OPTIONS = [
  { id: "terraform" as const, label: "Terraform" },
  { id: "opentofu" as const, label: "OpenTofu" },
];

function modelTag(m: ModelOption): { label: string; className: string } | null {
  if (m.id === "gemini-2.0-flash" || m.id === "gpt-4o-mini")
    return { label: "Fast", className: "bg-[var(--success-bg)] text-[var(--success-text)]" };
  if (m.id === "llama-3.3-70b")
    return { label: "Free", className: "bg-[var(--success-bg)] text-[var(--success-text)]" };
  if (m.id === "claude-sonnet")
    return { label: "Recommended", className: "bg-[var(--info-bg)] text-[var(--info-text)]" };
  if (m.id === "claude-opus")
    return { label: "Powerful", className: "bg-[var(--purple-bg)] text-[var(--purple-text)]" };
  return null;
}

export default function NewSessionPage() {
  const router = useRouter();
  const [targetEnv, setTargetEnv] = useState<"aws" | "gcp">("aws");
  const [iacTool, setIacTool] = useState<"terraform" | "opentofu">("terraform");
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadModels() {
      try {
        const res = await fetch("/api/api-keys");
        const keys: { provider: string }[] = res.ok ? await res.json() : [];
        const hasOpenRouter = keys.some((k) => k.provider === "openrouter");
        const hasAnthropic = keys.some((k) => k.provider === "anthropic");
        setModels(getAvailableModels(hasOpenRouter, hasAnthropic));
      } catch {
        // Fallback to free models only
        setModels(getAvailableModels(false, false));
      }
    }
    loadModels();
  }, []);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const name = `New ${targetEnv.toUpperCase()} Session`;
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetEnv, iacTool, model: selectedModel }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create session");
        return;
      }
      const session = await res.json();
      router.push(`/session/${session.id}`);
    } catch {
      setError("Failed to create session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto bg-[var(--surface2)] p-7">
      <div className="flex w-full max-w-[560px] flex-col gap-5">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">New session</h1>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Configure your session. These settings apply for the entire chat.
          </p>
        </div>

        {/* Session Configuration */}
        <section className="flex flex-col gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-[var(--info-bg)] text-[11px] text-[var(--info-text)]">
              ☁
            </span>
            Session Configuration
          </div>

          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--hint)]">
            Target environment
          </div>
          <div className="flex gap-1.5">
            {ENV_OPTIONS.map((env) => (
              <button
                key={env.id}
                onClick={() => setTargetEnv(env.id)}
                className={`flex-1 cursor-pointer rounded-lg border p-2.5 transition-colors ${
                  targetEnv === env.id
                    ? "border-[var(--text)] bg-[var(--surface)]"
                    : "border-[var(--border)] bg-[var(--surface2)] hover:border-[var(--border2)]"
                }`}
              >
                <div className="text-[11px] font-semibold">{env.name}</div>
                <div className="mt-0.5 text-[9px] text-[var(--muted)]">{env.sub}</div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="w-[90px] shrink-0 text-[11px] text-[var(--muted)]">IaC tool</span>
            <select
              value={iacTool}
              onChange={(e) => setIacTool(e.target.value as "terraform" | "opentofu")}
              className="flex-1 rounded-md border border-[var(--border2)] bg-[var(--surface2)] px-2.5 py-[7px] text-[11px] text-[var(--text)]"
            >
              {IAC_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* GitHub Integration */}
        <section className="flex flex-col gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <svg width="16" height="16" viewBox="0 0 98 96" fill="currentColor">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
              />
            </svg>
            GitHub Integration
          </div>
          <div className="rounded-[5px] bg-[var(--warn-bg)] px-2.5 py-1.5 text-[10px] text-[var(--warn-text)]">
            ⚠ GitHub not connected.{" "}
            <button
              onClick={() => router.push("/settings/api-keys")}
              className="cursor-pointer font-medium underline"
            >
              Connect in Settings
            </button>
          </div>
          <div className="text-[10px] text-[var(--muted)]">
            Optional — you can also export code without GitHub.
          </div>
        </section>

        {/* Model */}
        <section className="flex flex-col gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold">
            <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-[var(--purple-bg)] text-[11px] text-[var(--purple-text)]">
              ✦
            </span>
            Model
          </div>
          <div className="flex flex-col gap-1">
            {models.map((m) => {
              const tag = modelTag(m);
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 transition-colors ${
                    selectedModel === m.id
                      ? "border-[var(--text)] bg-[var(--surface)]"
                      : "border-[var(--border)] bg-[var(--surface2)] hover:border-[var(--border2)]"
                  }`}
                >
                  <div
                    className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                      selectedModel === m.id ? "border-[var(--text)]" : "border-[var(--border2)]"
                    }`}
                  >
                    {selectedModel === m.id && (
                      <div className="h-1.5 w-1.5 rounded-full bg-[var(--text)]" />
                    )}
                  </div>
                  <span className="flex-1 text-left text-[11px] font-medium">{m.name}</span>
                  {tag && (
                    <span className={`rounded-[3px] px-1.5 py-px text-[9px] font-medium ${tag.className}`}>
                      {tag.label}
                    </span>
                  )}
                </button>
              );
            })}
            {models.length === 0 && (
              <div className="py-3 text-center text-[11px] text-[var(--hint)]">
                Loading models…
              </div>
            )}
          </div>
        </section>

        {/* Error */}
        {error && (
          <div className="rounded-[5px] bg-[var(--danger-bg)] px-3 py-2 text-[11px] text-[var(--danger-text)]">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => router.push("/home")}
            className="cursor-pointer rounded-[7px] border border-[var(--border2)] bg-transparent px-4.5 py-2 text-xs text-[var(--text)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || models.length === 0}
            className="cursor-pointer rounded-[7px] border-none bg-[var(--text)] px-6 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Start session →"}
          </button>
        </div>
      </div>
    </div>
  );
}
