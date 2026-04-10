"use client";

import { createClient } from "@/lib/supabase/client";
import { type GitHubStatus } from "@/lib/github/client";
import { type UserIdentity } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

function mapConnectErrorMessage(message?: string): string {
  if (!message) return "Failed to start GitHub linking";

  const normalized = message.toLowerCase();
  if (normalized.includes("manual linking is disabled")) {
    return "GitHub linking is disabled in Supabase. Enable manual linking in Supabase Auth settings, then try again.";
  }

  return message;
}

export function useGitHubConnection() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<GitHubStatus>({
    connected: false,
    username: null,
    avatarUrl: null,
  });
  const [primaryProvider, setPrimaryProvider] = useState<string | null>(null);
  const [githubIdentity, setGithubIdentity] = useState<UserIdentity | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [statusRes, userRes, identitiesRes] = await Promise.all([
      fetch("/api/github/status", { cache: "no-store" }),
      supabase.auth.getUser(),
      supabase.auth.getUserIdentities(),
    ]);

    if (!statusRes.ok) {
      setLoading(false);
      setError("Failed to load GitHub status");
      return;
    }

    const data = (await statusRes.json()) as GitHubStatus;
    setStatus(data);
    setPrimaryProvider(userRes.data.user?.app_metadata?.provider ?? null);

    const identities = (identitiesRes.data?.identities ?? []) as UserIdentity[];
    setGithubIdentity(identities.find((i) => i.provider === "github") ?? null);
    setLoading(false);
  }, [supabase.auth]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleConnect() {
    setError(null);
    setConnecting(true);

    try {
      if (primaryProvider === "email") {
        const redirectTo = `${window.location.origin}/api/auth/callback?next=/settings/github`;
        const { data, error: linkError } = await supabase.auth.linkIdentity({
          provider: "github",
          options: { redirectTo },
        });

        if (linkError || !data?.url) {
          setError(mapConnectErrorMessage(linkError?.message));
          setConnecting(false);
          return;
        }

        window.location.assign(data.url);
        return;
      }

      window.location.assign("/api/auth/github");
    } catch {
      setError("Failed to start GitHub connection");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    setDisconnecting(true);

    try {
      if (primaryProvider === "email" && githubIdentity) {
        const { error: unlinkError } = await supabase.auth.unlinkIdentity(githubIdentity);

        if (unlinkError) {
          setError(unlinkError.message || "Failed to disconnect GitHub");
          setDisconnecting(false);
          return;
        }

        await fetchStatus();
        setDisconnecting(false);
        return;
      }

      await supabase.auth.signOut();
      window.location.assign("/login");
    } catch {
      setError("Failed to disconnect GitHub");
      setDisconnecting(false);
    }
  }

  return {
    loading,
    connecting,
    disconnecting,
    error,
    status,
    primaryProvider,
    handleConnect,
    handleDisconnect,
  };
}
