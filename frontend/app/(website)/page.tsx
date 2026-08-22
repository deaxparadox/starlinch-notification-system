"use client";

import Link from "next/link";

import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { status, user } = useAuth();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <h1 className="text-2xl font-semibold">Starclinch Notification System</h1>

      {status === "loading" && <p className="text-sm text-neutral-500">Loading…</p>}

      {status === "anonymous" && (
        <>
          <p className="text-sm text-neutral-500">You&apos;re not logged in.</p>
          <Link href="/login" className="text-sm underline">
            Log in
          </Link>
        </>
      )}

      {status === "authenticated" && (
        <>
          <p className="text-sm text-neutral-500">
            {user ? `Welcome back, ${user.username}.` : "You're logged in."}
          </p>
          <Link href="/logout" className="text-sm underline">
            Log out
          </Link>
        </>
      )}
    </div>
  );
}
