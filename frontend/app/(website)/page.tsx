"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { GradientHero } from "@/components/ui/gradient-hero";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

export default function HomePage() {
  const { status, user } = useAuth();

  return (
    <GradientHero
      size="full"
      padded={false}
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 p-16 text-center"
    >
      <h1 className="text-2xl font-semibold text-foreground">Starclinch Notification System</h1>

      {status === "loading" && <Skeleton className="h-9 w-28" />}

      {status === "anonymous" && (
        <>
          <p className="text-sm text-foreground-muted">You&apos;re not logged in.</p>
          <Link href="/login" className={buttonVariants("primary", "md")}>
            Log in
          </Link>
        </>
      )}

      {status === "authenticated" && (
        <>
          <p className="text-sm text-foreground-muted">
            {user ? `Welcome back, ${user.username}.` : "You're logged in."}
          </p>
          <Link href="/logout" className={buttonVariants("secondary", "md")}>
            Log out
          </Link>
        </>
      )}
    </GradientHero>
  );
}
