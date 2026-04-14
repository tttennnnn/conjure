"use client";

import { useEffect, useRef, useState } from "react";
import { useDeployPlan } from "./hooks/useDeployPlan";
import { useDeployApply } from "./hooks/useDeployApply";
import { downloadAsZip } from "@/lib/utils/zip";
import type { IacFiles } from "./CodePanel";
import type { CredentialProfileSummary } from "@/lib/vault/credentials";

interface DeployPanelProps {
  sessionId: string;
  targetEnv: string;
  iacCode: IacFiles;
  isStale: boolean;
  lastPlanStatus: string | null;
  lastPlanOutput: string | null;
  lastApplyStatus: string | null;
  lastApplyOutput: string | null;
  stateBackend: Record<string, unknown> | null;
  deployJobId: string | null;
  applyJobId: string | null;
}

export default function DeployPanel({
  sessionId,
  targetEnv,
  iacCode,
  isStale,
  lastPlanStatus,
  lastPlanOutput,
  lastApplyStatus,
  lastApplyOutput,
  stateBackend: initialStateBackend,
  deployJobId,
  applyJobId,
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

  const planOutputRef = useRef<HTMLPreElement>(null);
  const applyOutputRef = useRef<HTMLPreElement>(null);

  const plan = useDeployPlan(sessionId, { lastPlanStatus, lastPlanOutput, deployJobId });
  const apply = useDeployApply(sessionId, { lastApplyStatus, lastApplyOutput, applyJobId });

  // Fetch credential profiles filtered by target provider
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

  // Pre-fill region from selected profile
  useEffect(() => {
    if (!useOneOff && selectedProfileId) {
      const profile = profiles.find((p) => p.id === selectedProfileId);
      if (profile?.defaultRegion) setRegion(profile.defaultRegion);
    }
  }, [selectedProfileId, profiles, useOneOff]);

  // Auto-scroll plan output
  useEffect(() => {
    if (planOutputRef.current && plan.isRunning) {
      planOutputRef.current.scrollTop = planOutputRef.current.scrollHeight;
    }
  }, [plan.output, plan.isRunning]);

  // Auto-scroll apply output
  useEffect(() => {
    if (applyOutputRef.current && apply.isRunning) {
      applyOutputRef.current.scrollTop = applyOutputRef.current.scrollHeight;
    }
  }, [apply.output, apply.isRunning]);

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

  // region and stateBackend are persisted at plan time — apply only needs credentials
  const canApply =
    plan.status === "completed" && !apply.isRunning && !isStale && hasCredentials;

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
    // region and stateBackend are read from the persisted plan server-side
    apply.runApply({ ...buildCredentialOpts() });
  }

  function handleDownloadZip() {
    downloadAsZip(
      [
        { name: "main.tf", content: iacCode.mainTf },
        { name: "variables.tf", content: iacCode.variablesTf },
        { name: "outputs.tf", content: iacCode.outputsTf },
      ],
      "terraform.zip",
    );
  }

  const inputClass =
    "rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-[12px] text-[var(--text)] font-mono placeholder:text-[var(--muted)]";

  return (
    <div className="flex flex-1 flex-col min-w-0 bg-[var(--bg)] overflow-auto">
      {/* Stale banner */}
      {isStale && (
        <div className="shrink-0 border-b border-[var(--warning-border,#f59e0b)] bg-[var(--warning-bg,#fef3c7)] px-4 py-2 text-[11px] text-[var(--warning-text,#92400e)]">
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
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
              Plan & Apply
            </h3>
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
                    ? "bg-emerald-600 text-white hover:opacity-90"
                    : "bg-[var(--surface2)] text-[var(--muted)] cursor-not-allowed",
                ].join(" ")}
              >
                {apply.isRunning ? "Applying…" : "Apply"}
              </button>
            </div>
          </div>

          {/* Plan error banner */}
          {plan.status === "failed" && plan.error && (
            <div className="mb-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {plan.error}
            </div>
          )}

          {/* Plan output panel */}
          {(plan.output || plan.isRunning || plan.status) && (
            <div className="mb-3 rounded-md border border-[var(--border)] bg-[#0d1117] overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#30363d] px-3 py-1.5">
                <span className="text-[10px] text-[#8b949e] font-mono">terraform plan</span>
                <StatusPill status={plan.status} />
              </div>
              <pre
                ref={planOutputRef}
                className="max-h-80 overflow-auto p-3 text-[11px] leading-relaxed text-[#e6edf3] font-mono whitespace-pre-wrap"
              >
                {plan.output || (plan.isRunning ? "Initializing…" : "")}
              </pre>
            </div>
          )}

          {/* Apply error banner */}
          {apply.status === "failed" && apply.error && (
            <div className="mb-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-700">
              {apply.error}
            </div>
          )}

          {/* Apply output panel */}
          {(apply.output || apply.isRunning || apply.status) && (
            <div className="rounded-md border border-[var(--border)] bg-[#0d1117] overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#30363d] px-3 py-1.5">
                <span className="text-[10px] text-[#8b949e] font-mono">terraform apply</span>
                <StatusPill status={apply.status} />
              </div>
              <pre
                ref={applyOutputRef}
                className="max-h-80 overflow-auto p-3 text-[11px] leading-relaxed text-[#e6edf3] font-mono whitespace-pre-wrap"
              >
                {apply.output || (apply.isRunning ? "Initializing…" : "")}
              </pre>
            </div>
          )}
        </section>

        {/* Export */}
        <section>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Export
          </h3>
          <button
            onClick={handleDownloadZip}
            className="rounded px-3 py-1 text-[11px] text-[var(--muted)] border border-[var(--border)] hover:bg-[var(--surface2)] hover:text-[var(--text)] transition-colors"
          >
            Download .zip
          </button>
        </section>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string | null }) {
  if (!status) return null;

  const styles: Record<string, string> = {
    pending: "bg-[#30363d] text-[#8b949e]",
    running: "bg-[#1f3d2b] text-[#3fb950]",
    completed: "bg-[#1a3a2a] text-[#56d364]",
    failed: "bg-[#3d1f1f] text-[#f85149]",
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
