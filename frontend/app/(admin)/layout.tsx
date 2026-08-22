"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminTopBar } from "@/components/AdminTopBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ForbiddenError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { useLocalStorageBoolean } from "@/lib/useLocalStorageBoolean";

const SIDEBAR_COLLAPSED_KEY = "admin-sidebar-collapsed";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { status, user, authFetch } = useAuth();
  const router = useRouter();
  // Authenticated (session recovered from a page reload) but `user` wasn't recovered with it -
  // /api/auth/refresh/ only returns a token, not user info. Probe an admin-only endpoint to
  // learn whether this session is staff.
  const needsProbe = status === "authenticated" && !user;
  const [probeGranted, setProbeGranted] = useState(false);
  const [collapsed, setCollapsed] = useLocalStorageBoolean(SIDEBAR_COLLAPSED_KEY);

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
    return (
      <div className="flex flex-1">
        <div className="flex w-[180px] shrink-0 flex-col gap-2 border-r border-border bg-surface p-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-7 w-full" />
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-6 w-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1">
      <AdminSidebar collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar collapsed={collapsed} onToggleSidebar={() => setCollapsed(!collapsed)} />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
