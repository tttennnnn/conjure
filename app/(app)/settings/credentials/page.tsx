export default function CredentialsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Cloud Credentials</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Manage your AWS and GCP credential profiles for deploying infrastructure.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface2)] py-12">
        <p className="text-sm text-[var(--hint)]">Not yet available</p>
        <p className="mt-1 text-xs text-[var(--hint)]">
          Cloud credential management is coming soon.
        </p>
      </div>
    </div>
  );
}
