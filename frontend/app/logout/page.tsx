"use client";

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
    <div className="flex flex-1 flex-col items-center justify-center p-16">
      <p className="text-sm text-neutral-500">Logging out…</p>
    </div>
  );
}
