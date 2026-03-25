"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div>
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
          We sent a password reset link to <strong>{email}</strong>. Click it to
          set a new password.
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
        <h2 className="text-lg font-semibold">Reset your password</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger-text)]">
          {error}
        </div>
      )}

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

      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-[7px] bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Sending..." : "Send reset link"}
      </button>

      <p className="mt-4 text-center text-[11px] text-[var(--muted)]">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-[var(--info-text)]">
          Sign in
        </Link>
      </p>
    </form>
  );
}
