"use client";

import ApiKeyCard from "@/components/settings/ApiKeyCard";
import { useCallback, useEffect, useState } from "react";

interface StoredKey {
  provider: string;
  key_hint: string | null;
  created_at: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    const res = await fetch("/api/api-keys");
    if (res.ok) {
      setKeys(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  function getKeyHint(provider: string): string | null {
    return keys.find((k) => k.provider === provider)?.key_hint ?? null;
  }

  async function handleSave(
    provider: string,
    key: string,
  ): Promise<{ error?: string }> {
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, key }),
    });

    if (!res.ok) {
      const data = await res.json();
      return { error: data.error || "Failed to save key" };
    }

    await fetchKeys();
    return {};
  }

  async function handleRemove(provider: string): Promise<{ error?: string }> {
    const res = await fetch(`/api/api-keys?provider=${provider}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      return { error: data.error || "Failed to remove key" };
    }

    await fetchKeys();
    return {};
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface2)]" />
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface2)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">LLM API Keys</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Add your own API keys to unlock additional models. Keys are encrypted
          and stored securely.
        </p>
      </div>

      <ApiKeyCard
        provider="openrouter"
        label="OpenRouter"
        description="Provide your own key to unlock all OpenRouter models"
        keyHint={getKeyHint("openrouter")}
        onSave={(key) => handleSave("openrouter", key)}
        onRemove={() => handleRemove("openrouter")}
      />

      <ApiKeyCard
        provider="anthropic"
        label="Anthropic"
        description="Provide your key to unlock Claude Sonnet and Claude Opus"
        keyHint={getKeyHint("anthropic")}
        onSave={(key) => handleSave("anthropic", key)}
        onRemove={() => handleRemove("anthropic")}
      />
    </div>
  );
}
