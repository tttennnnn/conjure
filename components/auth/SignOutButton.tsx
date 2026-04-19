"use client";

import { useState } from "react";

export default function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const res = await fetch("/api/auth/signout", {
        method: "POST",
        redirect: "manual",
      });
      if (!res.ok && res.type !== "opaqueredirect") {
        throw new Error("Sign out failed");
      }
      window.location.href = "/login";
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={signingOut}
      className="mt-2 text-sm text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-50"
    >
      {signingOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
