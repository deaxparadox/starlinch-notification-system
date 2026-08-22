"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  const { status, user } = useAuth();

  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <span className="text-sm font-semibold text-foreground">Starclinch</span>
        {status === "authenticated" && user?.is_staff && (
          <Link href="/admin" className={buttonVariants("secondary", "sm")}>
            Admin
          </Link>
        )}
      </nav>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
