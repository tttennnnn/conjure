"use client";

import { useEffect, useRef, useState } from "react";
import { useDeployPlan } from "./hooks/useDeployPlan";
import { useDeployApply } from "./hooks/useDeployApply";
import { useDeployDestroy } from "./hooks/useDeployDestroy";
import type { CredentialProfileSummary } from "@/lib/vault/credentials";

const TERMINAL_BG = "#0d1117";
const TERMINAL_TEXT = "#e6edf3";
const TERMINAL_BORDER = "#30363d";
const TERMINAL_MUTED = "#8b949e";

interface DeployPanelProps {
  sessionId: string;
  targetEnv: string;
  isStale: boolean;
  lastPlanStatus: string | null;
  lastPlanOutput: string | null;
  lastApplyStatus: string | null;
  lastApplyOutput: string | null;
  stateBackend: Record<string, unknown> | null;
  deployJobId: string | null;
  applyJobId: string | null;
  destroyJobId: string | null;
  lastDestroyStatus: string | null;
  lastDestroyOutput: string | null;
  planCredentialProfileId: string | null;
  planRegion: string | null;
  planOutputStale: boolean;
  applyOutputStale: boolean;
  onPlanStarted: () => void;
  onApplyStarted: () => void;
  githubRepo: string | null;
}

export default function DeployPanel({
  sessionId,
  targetEnv,
  isStale,
  lastPlanStatus,
  lastPlanOutput,
  lastApplyStatus,
  lastApplyOutput,
  stateBackend: initialStateBackend,
  deployJobId,
  applyJobId,
  destroyJobId,
  lastDestroyStatus,
  lastDestroyOutput,
  planCredentialProfileId,
  planRegion,
  planOutputStale,
  applyOutputStale,
  onPlanStarted,
  onApplyStarted,
  githubRepo,
}: DeployPanelProps) {
  const [profiles, setProfiles] = useState<CredentialProfileSummary[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [useOneOff, setUseOneOff] = useState(false);
  const [oneOffKey, setOneOffKey] = useState("");
  const [oneOffSecret, setOneOffSecret] = useState("");
  const [region, setRegion] = useState("");

  // State backend fields — AWS
  const [s3Bucket, setS3Bucket] = useState((initialStateBackend?.bucket as string) ?? "");
  const [s3KeyPrefix, setS3KeyPrefix] = useState((initialStateBackend?.keyPrefix as string) ?? "");
  const [s3Region, setS3Region] = useState((initialStateBackend?.region as string) ?? "");
  const [dynamodbTable, setDynamodbTable] = useState((initialStateBackend?.dynamodbTable as string) ?? "");

  // State backend fields — GCP
  const [gcsBucket, setGcsBucket] = useState((initialStateBackend?.bucket as string) ?? "");
  const [gcsPrefix, setGcsPrefix] = useState((initialStateBackend?.prefix as string) ?? "");

  const [planApplyOpen, setPlanApplyOpen] = useState(true);
  // GitHub export state
  const [ghExportOpen, setGhExportOpen] = useState(false);
  const [ghBranch, setGhBranch] = useState("conjure/terraform");
  const [ghCreatePr, setGhCreatePr] = useState(false);
  const [ghBaseBranch, setGhBaseBranch] = useState("main");
  const [ghExportStatus, setGhExportStatus] = useState<"idle" | "pushing" | "success" | "error">("idle");
  const [ghExportResult, setGhExportResult] = useState<{ sha?: string; prUrl?: string; error?: string } | null>(null);

  const [dangerOpen, setDangerOpen] = useState(false);

  const plan = useDeployPlan(sessionId, { lastPlanStatus, lastPlanOutput, deployJobId, planRegion, planCredentialProfileId });
  const apply = useDeployApply(sessionId, { lastApplyStatus, lastApplyOutput, applyJobId });
  const destroy = useDeployDestroy(sessionId, { lastDestroyStatus, lastDestroyOutput, destroyJobId });

  useEffect(() => {
    setProfilesLoading(true);
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((data: CredentialProfileSummary[]) => {
        const filtered = Array.isArray(data)
          ? data.filter((p) => p.provider === targetEnv)
          : [];
        setProfiles(filtered);
      })
      .catch(() => setProfiles([]))
      .finally(() => setProfilesLoading(false));
  }, [targetEnv]);

  useEffect(() => {
    if (!useOneOff && selectedProfileId) {
      const profile = profiles.find((p) => p.id === selectedProfileId);
      if (profile?.defaultRegion) setRegion(profile.defaultRegion);
    }
  }, [selectedProfileId, profiles, useOneOff]);

  // Auto-expand sections when jobs start running
  useEffect(() => {
    if (plan.isRunning || apply.isRunning) setPlanApplyOpen(true);
  }, [plan.isRunning, apply.isRunning]);

  useEffect(() => {
    if (destroy.isRunning) setDangerOpen(true);
  }, [destroy.isRunning]);

  const isAwsTarget = targetEnv === "aws";

  const hasCredentials = useOneOff
    ? oneOffKey.trim().length > 0 && (isAwsTarget ? oneOffSecret.trim().length > 0 : true)
    : selectedProfileId.length > 0;

  const hasStateBackend = isAwsTarget
    ? s3Bucket.trim().length > 0 && s3KeyPrefix.trim().length > 0 && s3Region.trim().length > 0
    : gcsBucket.trim().length > 0 && gcsPrefix.trim().length > 0;

  const canRunPlan =
    hasCredentials && region.trim().length > 0 && hasStateBackend &&
    !isStale && !plan.isRunning && !apply.isRunning;

  const canApply =
    plan.status === "completed" && !apply.isRunning && !isStale && !planOutputStale && hasCredentials;

  const canDestroy =
    (apply.status === "completed" || apply.status === "failed") &&
    destroy.status !== "completed" &&
    !destroy.isRunning &&
    hasCredentials;

  function buildStateBackend(): Record<string, unknown> {
    if (isAwsTarget) {
      return {
        type: "s3",
        bucket: s3Bucket.trim(),
        keyPrefix: s3KeyPrefix.trim(),
        region: s3Region.trim(),
        ...(dynamodbTable.trim() && { dynamodbTable: dynamodbTable.trim() }),
      };
    }
    return {
      type: "gcs",
      bucket: gcsBucket.trim(),
      prefix: gcsPrefix.trim(),
    };
  }

  function buildCredentialOpts(): { credentialProfileId?: string; oneOffCredentials?: Record<string, string> } {
    if (useOneOff) {
      const creds: Record<string, string> = isAwsTarget
        ? { accessKeyId: oneOffKey.trim(), secretAccessKey: oneOffSecret.trim() }
        : { serviceAccountJson: oneOffKey.trim() };
      return { oneOffCredentials: creds };
    }
    return { credentialProfileId: selectedProfileId };
  }

  function handleRunPlan() {
    if (!canRunPlan) return;
    onPlanStarted();
    plan.runPlan({
      ...buildCredentialOpts(),
      region: region.trim(),
      stateBackend: buildStateBackend(),
    });
  }

  function handleApply() {
    if (!canApply) return;
    const confirmed = window.confirm(
      "This will provision real cloud resources and may incur costs. Continue?",
    );
    if (!confirmed) return;
    onApplyStarted();
    apply.runApply({ ...buildCredentialOpts() });
  }

  function handleDestroy() {
    if (!canDestroy) return;
    const confirmed = window.confirm(
      "⚠️ DANGER: This will permanently destroy ALL provisioned cloud resources.\n\nThis action cannot be undone. Terraform state will be wiped.",
    );
    if (!confirmed) return;
    destroy.runDestroy({ ...buildCredentialOpts() });
  }

  async function handleGitHubExport() {
    if (!githubRepo || ghExportStatus === "pushing") return;
    setGhExportStatus("pushing");
    setGhExportResult(null);
    try {
      const res = await fetch("/api/github/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          repo: githubRepo,
          branch: ghBranch.trim(),
          createPr: ghCreatePr,
          ...(ghCreatePr && { baseBranch: ghBaseBranch.trim() }),
        }),
      });
      const data = await res.json() as { sha?: string; prUrl?: string; prError?: string; error?: string };
      if (!res.ok && res.status !== 207) {
        setGhExportStatus("error");
        setGhExportResult({ error: data.error ?? "Export failed" });
      } else {
        setGhExportStatus("success");
        setGhExportResult({ sha: data.sha, prUrl: data.prUrl, error: data.prError });
      }
    } catch {
      setGhExportStatus("error");
      setGhExportResult({ error: "Network error — could not reach server" });
    }
  }

  const inputClass =
    "rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[12px] text-[var(--text)] font-mono placeholder:text-[var(--muted)]";

  return (
    <div className="flex flex-1 flex-col min-w-0 bg-[var(--bg)] overflow-auto">
      {/* Stale banner */}
      {isStale && (
        <div className="shrink-0 border-b border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-2 text-[11px] text-[var(--warning-text)]">
          Diagram or config has changed — regenerate code before running plan.
        </div>
      )}

      <div className="flex flex-col gap-5 p-4">
        {/* Cloud Configuration */}
        <section>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Cloud Configuration
          </h3>

          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-3">
            {/* Credential selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[var(--muted)]">Credential</label>

              {!useOneOff && (
                <select
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  disabled={profilesLoading}
                  className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[12px] text-[var(--text)] disabled:text-[var(--muted)]"
                >
                  <option value="">
                    {profilesLoading
                      ? "Loading profiles…"
                      : profiles.length === 0
                      ? `No ${targetEnv.toUpperCase()} profiles saved`
                      : "Select a profile…"}
                  </option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.hint})
                    </option>
                  ))}
                </select>
              )}

              {useOneOff && (
                <div className="flex flex-col gap-2">
                  {isAwsTarget ? (
                    <>
                      <input
                        type="text"
                        placeholder="Access Key ID"
                        value={oneOffKey}
                        onChange={(e) => setOneOffKey(e.target.value)}
                        className={inputClass}
                        autoComplete="off"
                      />
                      <input
                        type="password"
                        placeholder="Secret Access Key"
                        value={oneOffSecret}
                        onChange={(e) => setOneOffSecret(e.target.value)}
                        className={inputClass}
                        autoComplete="off"
                      />
                    </>
                  ) : (
                    <textarea
                      placeholder="Paste service account JSON"
                      value={oneOffKey}
                      onChange={(e) => setOneOffKey(e.target.value)}
                      rows={4}
                      className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[11px] text-[var(--text)] font-mono placeholder:text-[var(--muted)] resize-none"
                      autoComplete="off"
                    />
                  )}
                </div>
              )}

              <label className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useOneOff}
                  onChange={(e) => {
                    setUseOneOff(e.target.checked);
                    setOneOffKey("");
                    setOneOffSecret("");
                    setSelectedProfileId("");
                  }}
                  className="accent-[var(--accent)]"
                />
                Use one-off keys (not saved)
              </label>
            </div>

            {/* Region */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-[var(--muted)]">Region</label>
              <input
                type="text"
                placeholder={isAwsTarget ? "us-east-1" : "us-central1"}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        {/* State Backend */}
        <section>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            State Backend
          </h3>

          <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-3">
            {isAwsTarget ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[var(--muted)]">S3 Bucket</label>
                  <input
                    type="text"
                    placeholder="my-terraform-state"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[var(--muted)]">Key Prefix</label>
                  <input
                    type="text"
                    placeholder="conjure/my-project/"
                    value={s3KeyPrefix}
                    onChange={(e) => setS3KeyPrefix(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[var(--muted)]">S3 Region</label>
                  <input
                    type="text"
                    placeholder="us-east-1"
                    value={s3Region}
                    onChange={(e) => setS3Region(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[var(--muted)]">
                    DynamoDB Lock Table <span className="text-[var(--hint)]">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="terraform-locks"
                    value={dynamodbTable}
                    onChange={(e) => setDynamodbTable(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[var(--muted)]">GCS Bucket</label>
                  <input
                    type="text"
                    placeholder="my-terraform-state"
                    value={gcsBucket}
                    onChange={(e) => setGcsBucket(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[var(--muted)]">Prefix</label>
                  <input
                    type="text"
                    placeholder="conjure/my-project/"
                    value={gcsPrefix}
                    onChange={(e) => setGcsPrefix(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </>
            )}
          </div>
        </section>

        {/* Plan & Apply */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => setPlanApplyOpen((v) => !v)}
              className="flex items-center gap-1.5"
            >
              <SectionChevron open={planApplyOpen} />
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Plan & Apply
              </h3>
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleRunPlan}
                disabled={!canRunPlan}
                className={[
                  "rounded px-3 py-1 text-[11px] font-medium transition-colors",
                  canRunPlan
                    ? "bg-[var(--accent)] text-white hover:opacity-90"
                    : "bg-[var(--surface2)] text-[var(--muted)] cursor-not-allowed",
                ].join(" ")}
              >
                {plan.isRunning ? "Running…" : "Run Plan"}
              </button>
              <button
                onClick={handleApply}
                disabled={!canApply}
                className={[
                  "rounded px-3 py-1 text-[11px] font-medium transition-colors",
                  canApply
                    ? "bg-[var(--success-text)] text-white hover:opacity-90"
                    : "bg-[var(--surface2)] text-[var(--muted)] cursor-not-allowed",
                ].join(" ")}
              >
                {apply.isRunning ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>

          {planApplyOpen && (
            <div className="flex flex-col gap-3">
              {/* Last plan context */}
              {plan.planRegion && (
                <div className="text-[11px] text-[var(--muted)]">
                  Planned with{" "}
                  {plan.planCredentialProfileId
                    ? <span className="font-medium text-[var(--text)]">{profiles.find((p) => p.id === plan.planCredentialProfileId)?.name ?? "saved profile"}</span>
                    : <span className="font-medium text-[var(--text)]">one-off credentials</span>}
                  {" "}in <span className="font-medium text-[var(--text)]">{plan.planRegion}</span>
                </div>
              )}

              <TerminalPanel
                label="terraform plan"
                status={plan.status}
                output={plan.output}
                isRunning={plan.isRunning}
                error={plan.error}
                staleMessage={planOutputStale && plan.status ? "From a previous code version — regenerate code and re-run plan." : null}
              />

              <TerminalPanel
                label="terraform apply"
                status={apply.status}
                output={apply.output}
                isRunning={apply.isRunning}
                error={apply.error}
                staleMessage={applyOutputStale && apply.status ? "From a previous plan cycle — run apply again to update." : null}
              />

            </div>
          )}
        </section>

        {/* GitHub Export */}
        <section>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Export to GitHub
          </h3>

          <div className={[
            "rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-3",
            !githubRepo ? "opacity-50" : "",
          ].join(" ")}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text)]">
                {githubRepo
                  ? <>Push to <span className="font-mono font-medium">{githubRepo}</span></>
                  : "No GitHub repo linked"}
              </span>
              {githubRepo && (
                <button
                  onClick={() => {
                    setGhExportOpen((v) => !v);
                    setGhExportStatus("idle");
                    setGhExportResult(null);
                  }}
                  className="text-[10px] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                >
                  {ghExportOpen ? "Cancel" : "Configure"}
                </button>
              )}
            </div>

            {!githubRepo && (
              <p className="text-[10px] text-[var(--muted)]">
                This session was not linked to a GitHub repository during session setup.
              </p>
            )}

            {githubRepo && ghExportOpen && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-[var(--muted)]">Branch</label>
                  <input
                    type="text"
                    value={ghBranch}
                    onChange={(e) => setGhBranch(e.target.value)}
                    placeholder="conjure/terraform"
                    className={inputClass}
                  />
                </div>

                <label className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ghCreatePr}
                    onChange={(e) => setGhCreatePr(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  Open pull request
                </label>

                {ghCreatePr && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-[var(--muted)]">Base branch</label>
                    <input
                      type="text"
                      value={ghBaseBranch}
                      onChange={(e) => setGhBaseBranch(e.target.value)}
                      placeholder="main"
                      className={inputClass}
                    />
                  </div>
                )}

                {ghCreatePr && ghBaseBranch.trim() === ghBranch.trim() && ghBranch.trim() && (
                  <p className="text-[10px] text-[var(--danger-text)]">
                    Branch and base branch must be different when creating a pull request.
                  </p>
                )}
                <button
                  onClick={handleGitHubExport}
                  disabled={
                    ghExportStatus === "pushing" ||
                    isStale ||
                    !ghBranch.trim() ||
                    (ghCreatePr && ghBaseBranch.trim() === ghBranch.trim())
                  }
                  className={[
                    "rounded px-3 py-1 text-[11px] font-medium transition-colors self-start",
                    ghExportStatus === "pushing" ||
                    isStale ||
                    !ghBranch.trim() ||
                    (ghCreatePr && ghBaseBranch.trim() === ghBranch.trim())
                      ? "bg-[var(--surface2)] text-[var(--muted)] cursor-not-allowed"
                      : "bg-[var(--accent)] text-white hover:opacity-90",
                  ].join(" ")}
                >
                  {ghExportStatus === "pushing" ? "Pushing…" : "Push to GitHub"}
                </button>
              </>
            )}

            {ghExportStatus === "success" && ghExportResult && (
              <div className="rounded border border-[var(--success-text)]/25 bg-[var(--success-bg)] px-3 py-2 text-[11px] text-[var(--success-text)] flex flex-col gap-1">
                <span>Pushed successfully ({ghExportResult.sha?.slice(0, 7)})</span>
                {ghExportResult.prUrl && (
                  <a
                    href={ghExportResult.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    View pull request →
                  </a>
                )}
                {ghExportResult.error && (
                  <span className="text-[var(--warning-text)]">
                    Push succeeded but PR creation failed: {ghExportResult.error}
                  </span>
                )}
              </div>
            )}
            {ghExportStatus === "error" && ghExportResult?.error && (
              <div className="rounded border border-[var(--danger-text)]/25 bg-[var(--danger-bg)] px-3 py-2 text-[11px] text-[var(--danger-text)]">
                {ghExportResult.error}
              </div>
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <button
            onClick={() => setDangerOpen((v) => !v)}
            className="flex items-center gap-1.5"
          >
            <SectionChevron open={dangerOpen} muted={false} />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--danger-text)]">
              Danger Zone
            </span>
          </button>

          {dangerOpen && (
            <div className="mt-3 rounded-md border border-[var(--danger-text)]/30 bg-[var(--danger-bg)] p-3 flex flex-col gap-3">
              {apply.status === "completed" || apply.status === "failed" ? (
                <>
                  <p className="text-[11px] text-[var(--danger-text)] leading-relaxed">
                    Permanently destroys all provisioned cloud resources. This action cannot be undone.
                  </p>

                  <button
                    onClick={handleDestroy}
                    disabled={!canDestroy}
                    className={[
                      "self-start rounded px-3 py-1 text-[11px] font-medium transition-colors",
                      canDestroy
                        ? "bg-[var(--danger-text)] text-white hover:opacity-90"
                        : "bg-[var(--surface2)] text-[var(--muted)] cursor-not-allowed",
                    ].join(" ")}
                  >
                    {destroy.isRunning ? "Destroying…" : "Destroy Infrastructure"}
                  </button>

                  {destroy.status === "completed" && (
                    <div className="rounded border border-[var(--success-text)]/25 bg-[var(--success-bg)] px-3 py-2 text-[11px] text-[var(--success-text)]">
                      All resources destroyed. Session reset to active.
                    </div>
                  )}

                  <TerminalPanel
                    label="terraform destroy"
                    status={destroy.status}
                    output={destroy.output}
                    isRunning={destroy.isRunning}
                    error={destroy.error}
                  />
                </>
              ) : apply.isRunning ? (
                <p className="text-[11px] text-[var(--muted)]">
                  Apply is in progress — check back once it completes.
                </p>
              ) : (
                <p className="text-[11px] text-[var(--muted)]">
                  No resources have been provisioned.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SectionChevron({ open, muted = true }: { open: boolean; muted?: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={[
        "shrink-0 transition-transform duration-150",
        open ? "rotate-90" : "",
        muted ? "text-[var(--muted)]" : "text-[var(--danger-text)]",
      ].join(" ")}
    >
      <polyline points="6 4 10 8 6 12" />
    </svg>
  );
}

function StatusPill({ status }: { status: string | null }) {
  if (!status) return null;

  const styles: Record<string, string> = {
    pending: "bg-[var(--surface2)] text-[var(--muted)]",
    running: "bg-[var(--info-bg)] text-[var(--info-text)]",
    completed: "bg-[var(--success-bg)] text-[var(--success-text)]",
    failed: "bg-[var(--danger-bg)] text-[var(--danger-text)]",
  };

  return (
    <span
      className={[
        "rounded-full px-2 py-0.5 text-[10px] font-medium",
        styles[status] ?? styles.pending,
      ].join(" ")}
    >
      {status === "running" ? "running…" : status}
    </span>
  );
}

function TerminalPanel({
  label,
  status,
  output,
  isRunning,
  error,
  staleMessage = null,
}: {
  label: string;
  status: string | null;
  output: string | null;
  isRunning: boolean;
  error: string | null;
  staleMessage?: string | null;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const [expanded, setExpanded] = useState(status !== "failed");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isRunning) setExpanded(true);
  }, [isRunning]);

  useEffect(() => {
    if (preRef.current && isRunning) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [output, isRunning]);

  const content = output || (isRunning ? "Initializing…" : "");
  if (!content && !status) return null;

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  return (
    <div className="rounded-md border border-[var(--border)] overflow-hidden" style={{ backgroundColor: TERMINAL_BG }}>
      <div
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer select-none"
        style={expanded && content ? { borderBottom: `1px solid ${TERMINAL_BORDER}` } : undefined}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="10" height="10" viewBox="0 0 16 16" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
            style={{ color: TERMINAL_MUTED }}
          >
            <polyline points="6 4 10 8 6 12" />
          </svg>
          <span className="font-mono text-[10px] shrink-0" style={{ color: TERMINAL_MUTED }}>{label}</span>
          <StatusPill status={status} />
          {status === "failed" && error && !expanded && (
            <span className="text-[10px] text-[var(--danger-text)] truncate">{error}</span>
          )}
          {staleMessage && !expanded && (
            <span className="text-[10px] text-[var(--warning-text)] truncate">{staleMessage}</span>
          )}
        </div>
        {output && (
          <button
            onClick={handleCopy}
            className="shrink-0 ml-2 text-[10px] hover:text-[var(--text)] transition-colors"
            style={{ color: TERMINAL_MUTED }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      {expanded && (
        <>
          {staleMessage && (
            <div
              className="px-3 py-2 text-[10px] text-[var(--warning-text)]"
              style={{ borderBottom: `1px solid ${TERMINAL_BORDER}`, backgroundColor: "rgba(210,153,34,0.08)" }}
            >
              {staleMessage}
            </div>
          )}
          {content && (
            <pre
              ref={preRef}
              className="max-h-80 overflow-auto p-3 text-[11px] leading-relaxed font-mono whitespace-pre-wrap"
              style={{ color: TERMINAL_TEXT }}
            >
              {content}
            </pre>
          )}
          {status === "failed" && error && (
            <div
              className="px-3 py-2 text-[10px] text-[var(--danger-text)]"
              style={{ borderTop: content ? `1px solid ${TERMINAL_BORDER}` : undefined }}
            >
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
