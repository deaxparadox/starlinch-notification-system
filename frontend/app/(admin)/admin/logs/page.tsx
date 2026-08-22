"use client";

import { Inbox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ChannelBadge, StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import type { Channel, NotificationLog, Trigger } from "@/lib/types";

const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  webpush: "Web Push",
};

export default function LogsPage() {
  const { authFetch } = useAuth();
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [logs, setLogs] = useState<NotificationLog[] | null>(null);
  const [error, setError] = useState("");

  const [triggerFilter, setTriggerFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    authFetch("/api/admin/triggers/")
      .then((res) => res.json())
      .then(setTriggers)
      .catch(() => {});
  }, [authFetch]);

  const hasFilters = Boolean(triggerFilter || channelFilter || statusFilter);

  const fetchLogs = useCallback(async (): Promise<NotificationLog[]> => {
    const params = new URLSearchParams();
    if (triggerFilter) params.set("trigger", triggerFilter);
    if (channelFilter) params.set("channel", channelFilter);
    if (statusFilter) params.set("status", statusFilter);
    const query = params.toString();
    const res = await authFetch(`/api/admin/logs/${query ? `?${query}` : ""}`);
    if (!res.ok) throw new Error("Failed to load logs.");
    return res.json();
  }, [authFetch, triggerFilter, channelFilter, statusFilter]);

  useEffect(() => {
    fetchLogs()
      .then(setLogs)
      .catch(() => setError("Failed to load logs."));
  }, [fetchLogs]);

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <h1 className="text-lg font-semibold text-foreground">Notification Logs</h1>

      <div className="flex flex-wrap gap-3">
        <Select value={triggerFilter} onChange={(e) => setTriggerFilter(e.target.value)} className="w-48">
          <option value="">All triggers</option>
          {triggers.map((t) => (
            <option key={t.id} value={t.key}>
              {t.display_name}
            </option>
          ))}
        </Select>
        <Select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className="w-40">
          <option value="">All channels</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="webpush">Web Push</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </Select>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {!logs && !error && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}

      {logs && logs.length === 0 && (
        <EmptyState
          icon={Inbox}
          title={hasFilters ? "No logs match these filters" : "No logs yet"}
          description={hasFilters ? "Try a different combination." : "Fire a trigger or test-send a template to see logs here."}
        />
      )}

      {logs && logs.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Time</TableHeaderCell>
              <TableHeaderCell>Trigger</TableHeaderCell>
              <TableHeaderCell>Channel</TableHeaderCell>
              <TableHeaderCell>Recipient</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Error</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-xs text-foreground-muted">
                  {new Date(log.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  {log.trigger_key ?? "—"}
                  {log.is_test && (
                    <span className="ml-1.5 rounded-radius-sm bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
                      test
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <ChannelBadge channel={log.channel}>{CHANNEL_LABELS[log.channel]}</ChannelBadge>
                </TableCell>
                <TableCell className="max-w-40 truncate font-mono text-xs" title={log.recipient}>
                  {log.recipient || "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={log.status === "sent" ? "success" : "error"}>
                    {log.status === "sent" ? "Sent" : "Failed"}
                  </StatusBadge>
                </TableCell>
                <TableCell className="max-w-56 truncate text-xs text-foreground-muted" title={log.error}>
                  {log.error || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
