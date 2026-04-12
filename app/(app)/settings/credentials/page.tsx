"use client";

import CredentialProfileCard from "@/components/settings/CredentialProfileCard";
import { useCallback, useEffect, useState } from "react";

interface CredentialProfile {
  id: string;
  provider: "aws" | "gcp";
  name: string;
  hint: string;
  defaultRegion: string;
  createdAt: string;
}

type AddProvider = "aws" | "gcp";

export default function CredentialsPage() {
  const [profiles, setProfiles] = useState<CredentialProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [addProvider, setAddProvider] = useState<AddProvider>("aws");
  const [addName, setAddName] = useState("");
  const [addRegion, setAddRegion] = useState("");
  const [addAccessKeyId, setAddAccessKeyId] = useState("");
  const [addSecretAccessKey, setAddSecretAccessKey] = useState("");
  const [addServiceAccountJson, setAddServiceAccountJson] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // ---------- Data fetching ----------

  const fetchProfiles = useCallback(async () => {
    const res = await fetch("/api/credentials");
    if (res.ok) {
      setProfiles(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // ---------- Add ----------

  function resetAddForm() {
    setAddName("");
    setAddRegion("");
    setAddAccessKeyId("");
    setAddSecretAccessKey("");
    setAddServiceAccountJson("");
    setAddError(null);
  }

  function handleProviderChange(provider: AddProvider) {
    setAddProvider(provider);
    setAddAccessKeyId("");
    setAddSecretAccessKey("");
    setAddServiceAccountJson("");
    setAddError(null);
  }

  async function handleAdd() {
    setAdding(true);
    setAddError(null);

    const credentials =
      addProvider === "aws"
        ? { accessKeyId: addAccessKeyId.trim(), secretAccessKey: addSecretAccessKey.trim() }
        : { serviceAccountJson: addServiceAccountJson.trim() };

    const res = await fetch("/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: addProvider,
        name: addName,
        credentials,
        defaultRegion: addRegion,
      }),
    });

    setAdding(false);

    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error || "Failed to add credential profile");
      return;
    }

    resetAddForm();
    setShowAddForm(false);
    await fetchProfiles();
  }

  // ---------- Update / Delete ----------

  async function handleUpdate(
    id: string,
    updates: {
      name?: string;
      credentials?: Record<string, string>;
      defaultRegion?: string;
    },
  ): Promise<{ error?: string }> {
    const res = await fetch("/api/credentials", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });

    if (!res.ok) {
      const data = await res.json();
      return { error: data.error || "Failed to update profile" };
    }

    await fetchProfiles();
    return {};
  }

  async function handleDelete(id: string): Promise<{ error?: string }> {
    const res = await fetch(`/api/credentials?id=${id}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json();
      return { error: data.error || "Failed to delete profile" };
    }

    await fetchProfiles();
    return {};
  }

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface2)]" />
      </div>
    );
  }

  const awsProfiles = profiles.filter((p) => p.provider === "aws");
  const gcpProfiles = profiles.filter((p) => p.provider === "gcp");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Cloud Credentials</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Manage your AWS and GCP credential profiles for deploying
          infrastructure. Credentials are encrypted and stored securely.
        </p>
      </div>

      {/* Add button */}
      {!showAddForm && (
        <button
          type="button"
          onClick={() => {
            resetAddForm();
            setShowAddForm(true);
          }}
          className="rounded-[var(--radius)] bg-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--surface)] transition-opacity hover:opacity-90"
        >
          Add Credential
        </button>
      )}

      {/* Add form */}
      {showAddForm && <AddCredentialForm
        provider={addProvider}
        name={addName}
        region={addRegion}
        accessKeyId={addAccessKeyId}
        secretAccessKey={addSecretAccessKey}
        serviceAccountJson={addServiceAccountJson}
        error={addError}
        saving={adding}
        onProviderChange={handleProviderChange}
        onNameChange={setAddName}
        onRegionChange={setAddRegion}
        onAccessKeyIdChange={setAddAccessKeyId}
        onSecretAccessKeyChange={setAddSecretAccessKey}
        onServiceAccountJsonChange={setAddServiceAccountJson}
        onSave={handleAdd}
        onCancel={() => {
          resetAddForm();
          setShowAddForm(false);
        }}
      />}

      {/* Profile list */}
      {profiles.length === 0 && !showAddForm && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface2)] py-12">
          <p className="text-sm text-[var(--hint)]">No credential profiles yet</p>
          <p className="mt-1 text-xs text-[var(--hint)]">
            Add one to get started with deploying infrastructure.
          </p>
        </div>
      )}

      {awsProfiles.length > 0 && (
        <ProfileSection
          label="AWS"
          profiles={awsProfiles}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {gcpProfiles.length > 0 && (
        <ProfileSection
          label="GCP"
          profiles={gcpProfiles}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProfileSection({
  label,
  profiles,
  onUpdate,
  onDelete,
}: {
  label: string;
  profiles: CredentialProfile[];
  onUpdate: (
    id: string,
    updates: {
      name?: string;
      credentials?: Record<string, string>;
      defaultRegion?: string;
    },
  ) => Promise<{ error?: string }>;
  onDelete: (id: string) => Promise<{ error?: string }>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--muted)]">{label}</h3>
      {profiles.map((profile) => (
        <CredentialProfileCard
          key={profile.id}
          profile={profile}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function AddCredentialForm({
  provider,
  name,
  region,
  accessKeyId,
  secretAccessKey,
  serviceAccountJson,
  error,
  saving,
  onProviderChange,
  onNameChange,
  onRegionChange,
  onAccessKeyIdChange,
  onSecretAccessKeyChange,
  onServiceAccountJsonChange,
  onSave,
  onCancel,
}: {
  provider: "aws" | "gcp";
  name: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  serviceAccountJson: string;
  error: string | null;
  saving: boolean;
  onProviderChange: (p: "aws" | "gcp") => void;
  onNameChange: (v: string) => void;
  onRegionChange: (v: string) => void;
  onAccessKeyIdChange: (v: string) => void;
  onSecretAccessKeyChange: (v: string) => void;
  onServiceAccountJsonChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <h3 className="text-sm font-semibold">Add Credential Profile</h3>

      {error && (
        <div className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">
          {error}
        </div>
      )}

      {/* Provider selector */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
          Provider
        </label>
        <div className="flex gap-2">
          {(["aws", "gcp"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onProviderChange(p)}
              className={`rounded-[var(--radius)] border px-4 py-1.5 text-sm font-medium transition-colors ${
                provider === p
                  ? "border-[var(--border2)] bg-[var(--surface2)]"
                  : "border-[var(--border)] hover:bg-[var(--surface2)]"
              }`}
            >
              {p === "aws" ? "AWS" : "GCP"}
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
          Profile Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Production, Staging"
          className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[var(--hint)] focus:border-[var(--border2)]"
        />
      </div>

      {/* Region */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
          Default Region
        </label>
        <input
          type="text"
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
          placeholder={provider === "aws" ? "us-east-1" : "us-central1"}
          className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[var(--hint)] focus:border-[var(--border2)]"
        />
      </div>

      {/* Provider-specific credential fields */}
      {provider === "aws" ? (
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
      ) : (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted)]">
            Service Account JSON
          </label>
          <textarea
            value={serviceAccountJson}
            onChange={(e) => onServiceAccountJsonChange(e.target.value)}
            placeholder='{"type": "service_account", ...}'
            rows={5}
            className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm outline-none transition-colors placeholder:text-[var(--hint)] focus:border-[var(--border2)]"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-[var(--radius)] bg-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--surface)] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface2)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
