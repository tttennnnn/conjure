"use client";

// TODO: Show GitHub connection status (connected account name + avatar, or "Not connected")
// TODO: "Connect GitHub" button — calls existing GET /api/auth/github to initiate OAuth
// TODO: "Disconnect" button — clears GitHub session/token
// TODO: Handle OAuth callback success/error states (callback already handled by app/api/auth/callback/route.ts)
// Follow the same page layout pattern as app/(app)/settings/api-keys/page.tsx

export default function GitHubPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">GitHub Integration</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Connect your GitHub account to link repositories to sessions and export code as pull requests.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface2)] py-12">
        <p className="text-sm text-[var(--hint)]">Not yet implemented</p>
        <p className="mt-1 text-xs text-[var(--hint)]">
          GitHub connection UI is being built.
        </p>
      </div>
    </div>
  );
}
