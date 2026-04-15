"use client";

import OAuthButtons from "@/components/auth/OAuthButtons";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function getInitialError(searchParams: URLSearchParams): string {
  if (searchParams.get("error") === "auth_failed") {
    return "Authentication failed. Please try again.";
  }
  return "";
}

function getHashError(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash;
  if (!hash.includes("error=")) return "";
  return "Authentication failed. Please try again.";
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(getInitialError(searchParams));
  const [verified, setVerified] = useState(searchParams.get("verified") === "true");
  const [passwordReset, setPasswordReset] = useState(searchParams.get("reset") === "true");
  const [loading, setLoading] = useState(false);

  // Pick up errors from URL hash (e.g. OAuth denial) and clean the URL
  useEffect(() => {
    const hashError = getHashError();
    if (hashError || searchParams.get("error") || searchParams.get("verified") || searchParams.get("reset")) {
      if (hashError) setError(hashError);
      window.history.replaceState(null, "", "/login");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setVerified(false);
    setPasswordReset(false);

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Welcome back</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Sign in to your account
        </p>
      </div>

      <OAuthButtons />

      {/* Divider */}
      <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-wide text-[var(--hint)]">
        <div className="h-px flex-1 bg-[var(--border)]" />
        or
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      {verified && (
        <div className="mb-3 rounded-md bg-[var(--success-bg)] px-3 py-2 text-xs text-[var(--success-text)]">
          Email verified successfully. You can now sign in.
        </div>
      )}

      {passwordReset && (
        <div className="mb-3 rounded-md bg-[var(--success-bg)] px-3 py-2 text-xs text-[var(--success-text)]">
          Password updated successfully. Sign in with your new password.
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-md bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium text-[var(--muted)]">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-md border border-[var(--border2)] bg-[var(--surface2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--text)] focus:bg-[var(--surface)]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-[var(--muted)]">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-md border border-[var(--border2)] bg-[var(--surface2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--text)] focus:bg-[var(--surface)]"
          />
        </div>
      </div>

      <div className="mt-1 text-right">
        <Link href="/forgot-password" className="text-[11px] text-[var(--muted)] hover:text-[var(--text)]">
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-3 w-full rounded-[var(--radius)] bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <p className="mt-4 text-center text-[11px] text-[var(--muted)]">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-[var(--info-text)]">
          Sign up
        </Link>
      </p>
    </form>
  );
}
