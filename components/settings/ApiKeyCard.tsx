"use client";

import { useState } from "react";

interface ApiKeyCardProps {
  provider: string;
  label: string;
  description: string;
  keyHint: string | null;
  onSave: (key: string) => Promise<{ error?: string }>;
  onRemove: () => Promise<{ error?: string }>;
}

export default function ApiKeyCard({
  provider,
  label,
  description,
  keyHint,
  onSave,
  onRemove,
}: ApiKeyCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = keyHint !== null;

  async function handleSave() {
    if (!keyInput.trim()) return;
    setSaving(true);
    setError(null);

    const result = await onSave(keyInput.trim());
    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      setKeyInput("");
      setIsEditing(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError(null);

    const result = await onRemove();
    setRemoving(false);

    if (result.error) {
      setError(result.error);
    }
  }

  function handleCancel() {
    setIsEditing(false);
    setKeyInput("");
    setError(null);
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold">{label}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isConnected
              ? "bg-[var(--success-bg)] text-[var(--success-text)]"
              : "bg-[var(--surface2)] text-[var(--muted)]"
          }`}
        >
          {isConnected ? "Connected" : "Not connected"}
        </span>
      </div>

      {error && (
        <div className="mt-4 rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger-text)]">
          {error}
        </div>
      )}

      {isConnected && !isEditing ? (
        <div className="mt-4">
          <div className="flex items-center gap-3">
            <code className="rounded-[var(--radius)] bg-[var(--surface2)] px-3 py-1.5 font-[family-name:var(--font-mono)] text-sm">
              {keyHint}
            </code>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-sm font-medium text-[var(--info-text)] hover:underline"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="text-sm font-medium text-[var(--danger-text)] hover:underline disabled:opacity-50"
              >
                {removing ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={`Paste your ${label} API key`}
              className="flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-[family-name:var(--font-mono)] text-sm outline-none transition-colors placeholder:text-[var(--hint)] focus:border-[var(--border2)]"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !keyInput.trim()}
              className="rounded-[var(--radius)] bg-[var(--text)] px-4 py-2 text-sm font-medium text-[var(--surface)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-[var(--radius)] border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--surface2)]"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
