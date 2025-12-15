"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { IdentityUser } from "@/lib/auth/types";

type UserSessionActionsProps = {
  user?: IdentityUser | null;
};

export function UserSessionActions({ user }: UserSessionActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Unable to sign out. Please try again.");
      }

      router.push("/login");
    } catch (signOutError) {
      const message = signOutError instanceof Error ? signOutError.message : "Sign-out failed";
      setError(message);
      setIsSigningOut(false);
    }
  };

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700 hover:shadow"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
        <div className="text-right text-sm leading-tight text-zinc-700">
          <div className="font-semibold text-zinc-900">{user.displayName ?? user.email ?? "Signed in"}</div>
          <div className="text-xs text-zinc-500">{user.role ?? "Authenticated user"}</div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
