"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ChannelBadge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GradientHero } from "@/components/ui/gradient-hero";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import type { Stats } from "@/lib/types";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function AdminOverviewPage() {
  const { authFetch } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  const fetchStats = useCallback(async (): Promise<Stats> => {
    const res = await authFetch("/api/admin/stats/");
    if (!res.ok) throw new Error("Failed to load stats.");
    return res.json();
  }, [authFetch]);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => setError("Failed to load stats."));
  }, [fetchStats]);

  return (
    <div className="flex flex-1 flex-col">
      <GradientHero size="full">
        <h1 className="text-4xl font-extrabold leading-tight text-foreground">
          {greeting()} 👋<br />Here&apos;s what your users saw today.
        </h1>
        {stats && (
          <p className="mt-2 max-w-md text-foreground-secondary">
            {stats.active_triggers} / {stats.total_triggers} triggers live across 3 channels.
          </p>
        )}
        <Link href="/admin/logs" className={buttonVariants("primary", "md", "mt-5")}>
          View all activity →
        </Link>
      </GradientHero>

      {error && <p className="px-12 pb-4 text-sm text-error">{error}</p>}

      {!stats && !error && (
        <div className="flex gap-4 px-12 pb-8">
          <Skeleton className="h-24 flex-1" />
          <Skeleton className="h-24 flex-1" />
          <Skeleton className="h-24 flex-1" />
        </div>
      )}

      {stats && (
        <div className="flex gap-4 px-12 pb-8">
          <Card className="flex-1 p-5">
            <div className="bg-gradient-to-r from-blob-1 to-blob-3 bg-clip-text text-3xl font-extrabold text-transparent">
              {stats.sent_today}
            </div>
            <div className="mt-1 text-xs text-foreground-muted">Notifications sent</div>
          </Card>
          <Card className="flex-1 p-5">
            <div className="text-3xl font-extrabold text-foreground">{stats.failed_today}</div>
            <div className="mt-1 text-xs text-foreground-muted">Failed sends</div>
          </Card>
          <Card className="flex-1 p-5">
            <div className="text-3xl font-extrabold text-foreground">
              {stats.active_triggers} / {stats.total_triggers}
            </div>
            <div className="mt-1 text-xs text-foreground-muted">Triggers active</div>
          </Card>
        </div>
      )}

      <div className="px-12 pb-12">
        <h2 className="mb-3 text-base font-bold text-foreground">Recent activity</h2>

        {stats && stats.recent.length === 0 && (
          <p className="text-sm text-foreground-muted">No activity yet.</p>
        )}

        {stats && stats.recent.length > 0 && (
          <div className="flex flex-col gap-2">
            {stats.recent.map((log) => (
              <div
                key={log.id}
                className="flex items-center gap-3 rounded-radius-md border border-border-subtle bg-surface px-4 py-3 text-sm"
              >
                <span className="font-medium text-foreground">{log.trigger_key ?? "—"}</span>
                <ChannelBadge channel={log.channel}>{log.channel}</ChannelBadge>
                <StatusBadge status={log.status === "sent" ? "success" : "error"}>
                  {log.status === "sent" ? "Sent" : "Failed"}
                </StatusBadge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
