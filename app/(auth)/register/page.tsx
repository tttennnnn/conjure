"use client";

import OAuthButtons from "@/components/auth/OAuthButtons";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!username || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < USERNAME_MIN_LENGTH || trimmedUsername.length > USERNAME_MAX_LENGTH) {
      setError(`Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`);
      return;
    }
    if (!USERNAME_PATTERN.test(trimmedUsername)) {
      setError("Username can only contain letters, numbers, underscores, and hyphens.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        data: { username: trimmedUsername },
      },
    });

    if (error) {
      const message =
        typeof error.message === "string" && error.message.trim() && error.message !== "{}"
          ? error.message
          : "Something went wrong. Please try again.";
      setError(message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="mt-2 text-xs text-[var(--muted)]">
          We sent a confirmation link to <strong>{email}</strong>. Click it to
          activate your account.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block text-xs font-medium text-[var(--info-text)]"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Create account</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Get started with Conjure
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-xs font-medium text-[var(--muted)]">
            Username
          </label>
          <input
            id="username"
            type="text"
            required
            minLength={USERNAME_MIN_LENGTH}
            maxLength={USERNAME_MAX_LENGTH}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="conjurer42"
            className="rounded-md border border-[var(--border2)] bg-[var(--surface2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--text)] focus:bg-[var(--surface)]"
          />
        </div>

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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="rounded-md border border-[var(--border2)] bg-[var(--surface2)] px-3 py-2.5 text-sm outline-none focus:border-[var(--text)] focus:bg-[var(--surface)]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-[7px] bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p className="mt-3 text-xs text-[var(--muted)]">
        We&apos;ll send a confirmation link to your email to verify your account.
      </p>

      <p className="mt-4 text-center text-[11px] text-[var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--info-text)]">
          Sign in
        </Link>
      </p>
    </form>
  );
}
