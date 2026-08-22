"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { ChannelBadge, StatusBadge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import type { Channel, Trigger } from "@/lib/types";

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "webpush", label: "Web Push" },
];

function CellBadge({ trigger, channel }: { trigger: Trigger; channel: Channel }) {
  const template = trigger.templates[channel];
  if (!template) return <StatusBadge status="muted">Not set</StatusBadge>;
  return template.is_active ? (
    <StatusBadge status="success">Active</StatusBadge>
  ) : (
    <StatusBadge status="error">Inactive</StatusBadge>
  );
}

export default function AdminDashboardPage() {
  const { authFetch } = useAuth();
  const [triggers, setTriggers] = useState<Trigger[] | null>(null);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Trigger | null>(null);

  const fetchTriggers = useCallback(async (): Promise<Trigger[]> => {
    const res = await authFetch("/api/admin/triggers/");
    if (!res.ok) throw new Error("Failed to load triggers.");
    return res.json();
  }, [authFetch]);

  useEffect(() => {
    fetchTriggers()
      .then(setTriggers)
      .catch(() => setError("Failed to load triggers."));
  }, [fetchTriggers]);

  async function handleDeleteConfirmed() {
    if (!pendingDelete) return;
    await authFetch(`/api/admin/triggers/${pendingDelete.id}/`, { method: "DELETE" });
    setPendingDelete(null);
    fetchTriggers()
      .then(setTriggers)
      .catch(() => setError("Failed to load triggers."));
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Notification Settings</h1>
        <Link href="/admin/triggers/new" className={buttonVariants("primary", "md")}>
          + New trigger
        </Link>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {!triggers && !error && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}

      {triggers && triggers.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="No triggers yet"
          description="Create one to get started."
          action={
            <Link href="/admin/triggers/new" className={buttonVariants("primary", "sm")}>
              + New trigger
            </Link>
          }
        />
      )}

      {triggers && triggers.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Trigger</TableHeaderCell>
              {CHANNELS.map((c) => (
                <TableHeaderCell key={c.key}>
                  <ChannelBadge channel={c.key}>{c.label}</ChannelBadge>
                </TableHeaderCell>
              ))}
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {triggers.map((trigger) => (
              <TableRow key={trigger.id}>
                <TableCell className="font-medium">{trigger.display_name}</TableCell>
                {CHANNELS.map((c) => (
                  <TableCell key={c.key}>
                    <Link href={`/admin/triggers/${trigger.id}/templates/${c.key}`}>
                      <CellBadge trigger={trigger} channel={c.key} />
                    </Link>
                  </TableCell>
                ))}
                <TableCell>
                  <button
                    onClick={() => setPendingDelete(trigger)}
                    className="text-sm font-medium text-error hover:underline"
                  >
                    Delete
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!pendingDelete} onClose={() => setPendingDelete(null)} title="Delete trigger?">
        <p className="mb-4 text-sm text-foreground-secondary">
          Delete &ldquo;{pendingDelete?.display_name}&rdquo;? This removes all its templates too.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPendingDelete(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDeleteConfirmed}>
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
