"use client";

import { useGitHubConnection } from "./use-github-connection";

export default function GitHubPage() {
  const {
    loading,
    connecting,
    disconnecting,
    error,
    status,
    primaryProvider,
    handleConnect,
    handleDisconnect,
  } = useGitHubConnection();

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
                  className="cursor-pointer rounded-[var(--radius)] border border-[var(--border2)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text)] transition-colors hover:border-[var(--text)] disabled:opacity-60"
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="cursor-pointer rounded-[var(--radius)] border-none bg-[var(--text)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
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
        <div className="rounded-[var(--radius)] bg-[var(--danger-bg)] px-3 py-2 text-[11px] text-[var(--danger-text)]">
          {error}
        </div>
      )}
    </div>
  );
}
