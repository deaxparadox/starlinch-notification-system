"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";

export default function LogoutPage() {
  const { logout } = useAuth();
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    logout().finally(() => router.replace("/"));
  }, [logout, router]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-16">
      <Loader2 className="size-5 animate-spin text-foreground-muted" aria-hidden />
      <p className="text-sm text-foreground-muted">Logging out…</p>
    </div>
  );
}
