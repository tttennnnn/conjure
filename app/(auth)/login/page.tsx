"use client";

import OAuthButtons from "@/components/auth/OAuthButtons";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(getInitialError(searchParams));
  const [loading, setLoading] = useState(false);

  // Pick up errors from URL hash (e.g. OAuth denial) and clean the URL
  useEffect(() => {
    const hashError = getHashError();
    if (hashError || searchParams.get("error")) {
      if (hashError) setError(hashError);
      window.history.replaceState(null, "", "/login");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

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

      {error && (
        <div className="mb-3 rounded-md bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-[11px] font-medium text-[var(--muted)]">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-md border border-[var(--border2)] bg-[var(--surface2)] px-2.5 py-2 text-xs outline-none focus:border-[var(--text)] focus:bg-[var(--surface)]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-[11px] font-medium text-[var(--muted)]">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-md border border-[var(--border2)] bg-[var(--surface2)] px-2.5 py-2 text-xs outline-none focus:border-[var(--text)] focus:bg-[var(--surface)]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded-[7px] bg-[var(--text)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
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
