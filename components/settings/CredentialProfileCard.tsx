"use client";

import { useState } from "react";

interface CredentialProfile {
  id: string;
  provider: "aws" | "gcp";
  name: string;
  hint: string;
  defaultRegion: string;
  createdAt: string;
}

interface CredentialProfileCardProps {
  profile: CredentialProfile;
  onUpdate: (
    id: string,
    updates: {
      name?: string;
      credentials?: Record<string, string>;
      defaultRegion?: string;
    },
  ) => Promise<{ error?: string }>;
  onDelete: (id: string) => Promise<{ error?: string }>;
}

type Mode = "view" | "edit" | "confirmDelete";

export default function CredentialProfileCard({
  profile,
  onUpdate,
  onDelete,
}: CredentialProfileCardProps) {
  const [mode, setMode] = useState<Mode>("view");
  const [editName, setEditName] = useState(profile.name);
  const [editRegion, setEditRegion] = useState(profile.defaultRegion);

  // AWS fields
  const [editAccessKeyId, setEditAccessKeyId] = useState("");
  const [editSecretAccessKey, setEditSecretAccessKey] = useState("");
  // GCP fields
  const [editServiceAccountJson, setEditServiceAccountJson] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function enterEdit() {
    setEditName(profile.name);
    setEditRegion(profile.defaultRegion);
    setEditAccessKeyId("");
    setEditSecretAccessKey("");
    setEditServiceAccountJson("");
    setError(null);
    setMode("edit");
  }

  function cancel() {
    setError(null);
    setMode("view");
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const updates: Parameters<typeof onUpdate>[1] = {};

    if (editName.trim() !== profile.name) {
      updates.name = editName.trim();
    }
    if (editRegion.trim() !== profile.defaultRegion) {
      updates.defaultRegion = editRegion.trim();
    }

    // Build credentials only if the user entered new values
    if (profile.provider === "aws") {
      if (editAccessKeyId || editSecretAccessKey) {
        if (!editAccessKeyId || !editSecretAccessKey) {
          setError("Both Access Key ID and Secret Access Key are required when updating credentials");
          setSaving(false);
          return;
        }
        updates.credentials = {
          accessKeyId: editAccessKeyId.trim(),
          secretAccessKey: editSecretAccessKey.trim(),
        };
      }
    } else {
      if (editServiceAccountJson) {
        updates.credentials = {
          serviceAccountJson: editServiceAccountJson.trim(),
        };
      }
    }

    if (Object.keys(updates).length === 0) {
      setError("No changes to save");
      setSaving(false);
      return;
    }

    const result = await onUpdate(profile.id, updates);
    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      setMode("view");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const result = await onDelete(profile.id);
    setDeleting(false);

    if (result.error) {
      setError(result.error);
      setMode("view");
    }
  }

  const providerLabel = profile.provider === "aws" ? "AWS" : "GCP";

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">
          {error}
        </div>
      )}

      {/* ---------- VIEW MODE ---------- */}
      {mode === "view" && (
        <>
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold">{profile.name}</h3>
                <span className="shrink-0 rounded-full bg-[var(--surface2)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
                  {providerLabel}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-[var(--radius)] bg-[var(--surface2)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs">
                  {profile.hint}
                </code>
                <span className="rounded-full bg-[var(--surface2)] px-2 py-0.5 text-xs text-[var(--muted)]">
                  {profile.defaultRegion}
                </span>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--success-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--success-text)]">
              Connected
            </span>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={enterEdit}
              className="text-sm font-medium text-[var(--info-text)] hover:underline"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode("confirmDelete");
              }}
              className="text-sm font-medium text-[var(--danger-text)] hover:underline"
            >
              Delete
            </button>
          </div>
        </>
      )}

      {/* ---------- EDIT MODE ---------- */}
      {mode === "edit" && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Profile Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[var(--hint)] focus:border-[var(--border2)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Default Region
            </label>
            <input
              type="text"
              value={editRegion}
              onChange={(e) => setEditRegion(e.target.value)}
              placeholder={profile.provider === "aws" ? "us-east-1" : "us-central1"}
              className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[var(--hint)] focus:border-[var(--border2)]"
            />
          </div>

          {profile.provider === "aws" ? (
            <AwsCredentialFields
              accessKeyId={editAccessKeyId}
              secretAccessKey={editSecretAccessKey}
              onAccessKeyIdChange={setEditAccessKeyId}
              onSecretAccessKeyChange={setEditSecretAccessKey}
            />
          ) : (
            <GcpCredentialFields
              serviceAccountJson={editServiceAccountJson}
              onChange={setEditServiceAccountJson}
            />
          )}

          <p className="text-xs text-[var(--hint)]">
            Leave credential fields empty to keep existing credentials.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-[var(--radius)] bg-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--surface)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface2)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ---------- CONFIRM DELETE MODE ---------- */}
      {mode === "confirmDelete" && (
        <div className="space-y-3">
          <p className="text-sm">
            Delete profile <strong>{profile.name}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-4 py-2 text-sm font-medium text-[var(--danger-text)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface2)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider-specific credential field sub-components
// ---------------------------------------------------------------------------

function AwsCredentialFields({
  accessKeyId,
  secretAccessKey,
  onAccessKeyIdChange,
  onSecretAccessKeyChange,
}: {
  accessKeyId: string;
  secretAccessKey: string;
  onAccessKeyIdChange: (v: string) => void;
  onSecretAccessKeyChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
          Access Key ID
        </label>
        <input
          type="password"
          value={accessKeyId}
          onChange={(e) => onAccessKeyIdChange(e.target.value)}
          placeholder="AKIA..."
          className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm outline-none transition-colors placeholder:text-[var(--hint)] focus:border-[var(--border2)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
          Secret Access Key
        </label>
        <input
          type="password"
          value={secretAccessKey}
          onChange={(e) => onSecretAccessKeyChange(e.target.value)}
          placeholder="wJalr..."
          className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm outline-none transition-colors placeholder:text-[var(--hint)] focus:border-[var(--border2)]"
        />
      </div>
    </div>
  );
}

function GcpCredentialFields({
  serviceAccountJson,
  onChange,
}: {
  serviceAccountJson: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
        Service Account JSON
      </label>
      <textarea
        value={serviceAccountJson}
        onChange={(e) => onChange(e.target.value)}
        placeholder='{"type": "service_account", ...}'
        rows={5}
        className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm outline-none transition-colors placeholder:text-[var(--hint)] focus:border-[var(--border2)]"
      />
    </div>
  );
}
