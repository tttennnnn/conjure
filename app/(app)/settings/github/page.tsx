"use client";

import { createClient } from "@/lib/supabase/client";
import { type GitHubStatus } from "@/lib/github/client";
import { type UserIdentity } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

type GitHubIdentity = {
  identityId: string;
  provider: string;
  rawIdentity: UserIdentity;
};

function mapConnectErrorMessage(message?: string): string {
  if (!message) return "Failed to start GitHub linking";

  const normalized = message.toLowerCase();
  if (normalized.includes("manual linking is disabled")) {
    return "GitHub linking is disabled in Supabase. Enable manual linking in Supabase Auth settings, then try again.";
  }

  return message;
}

export default function GitHubPage() {
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
  const [githubIdentity, setGithubIdentity] = useState<GitHubIdentity | null>(null);

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

    const identities = ((identitiesRes.data?.identities ?? []) as UserIdentity[]).map(
      (identity): GitHubIdentity => ({
        identityId: identity.identity_id,
        provider: identity.provider,
        rawIdentity: identity,
      }),
    );
    const githubIdentityItem = identities.find((item) => item.provider === "github") ?? null;
    setGithubIdentity(githubIdentityItem);
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
        const { error: unlinkError } = await supabase.auth.unlinkIdentity(githubIdentity.rawIdentity);

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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">GitHub Integration</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Connect your GitHub account to link repositories to sessions and export code as pull requests.
        </p>
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--surface2)]" />
      ) : (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface2)]">
                {status.avatarUrl ? (
                  // External avatar URL from GitHub — can't use next/image without adding github.com to remotePatterns config
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={status.avatarUrl} alt="GitHub avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[var(--muted)]">
                    GH
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">
                  {status.connected
                    ? `Connected${status.username ? ` as ${status.username}` : ""}`
                    : "Not connected"}
                </div>
                <p className="text-xs text-[var(--muted)]">
                  {status.connected
                    ? "You can pick repositories when creating a new session."
                    : "Connect GitHub to enable repository selection and PR export."}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              {status.connected ? (
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="cursor-pointer rounded-[7px] border border-[var(--border2)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text)] transition-colors hover:border-[var(--text)] disabled:opacity-60"
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="cursor-pointer rounded-[7px] border-none bg-[var(--text)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {connecting ? "Connecting..." : "Connect GitHub"}
                </button>
              )}
            </div>
          </div>

          {primaryProvider === "email" && !status.connected && (
            <p className="mt-3 text-xs text-[var(--muted)]">
              You are signed in with email. Connecting GitHub will link your identity to this account.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-[5px] bg-[var(--danger-bg)] px-3 py-2 text-[11px] text-[var(--danger-text)]">
          {error}
        </div>
      )}
    </div>
  );
}
