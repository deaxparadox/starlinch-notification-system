"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ForbiddenError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { status, user, authFetch } = useAuth();
  const router = useRouter();
  // Authenticated (session recovered from a page reload) but `user` wasn't recovered with it -
  // /api/auth/refresh/ only returns a token, not user info. Probe an admin-only endpoint to
  // learn whether this session is staff.
  const needsProbe = status === "authenticated" && !user;
  const [probeGranted, setProbeGranted] = useState(false);

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (user && !user.is_staff) {
      router.replace("/unauthorized");
    }
  }, [user, router]);

  useEffect(() => {
    if (!needsProbe) return;
    let cancelled = false;
    authFetch("/api/admin/triggers/")
      .then(() => {
        if (!cancelled) setProbeGranted(true);
      })
      .catch((err) => {
        if (cancelled) return;
        router.replace(err instanceof ForbiddenError ? "/unauthorized" : "/login");
      });
    return () => {
      cancelled = true;
    };
  }, [needsProbe, authFetch, router]);

  const accessGranted = Boolean(user?.is_staff) || probeGranted;

  if (!accessGranted) {
    return <p className="p-8 text-sm text-neutral-500">Checking access…</p>;
  }

  return <div className="flex flex-1 flex-col">{children}</div>;
}
