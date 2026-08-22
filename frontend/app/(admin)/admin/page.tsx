"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";
import type { Channel, Trigger } from "@/lib/types";

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "email", label: "Email" },
  { key: "webpush", label: "Web Push" },
];

function cellLabel(trigger: Trigger, channel: Channel): string {
  const template = trigger.templates[channel];
  if (!template) return "Not set";
  return template.is_active ? "Active" : "Inactive";
}

export default function AdminDashboardPage() {
  const { authFetch } = useAuth();
  const [triggers, setTriggers] = useState<Trigger[] | null>(null);
  const [error, setError] = useState("");

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

  async function handleDelete(trigger: Trigger) {
    if (!confirm(`Delete trigger "${trigger.display_name}"? This removes all its templates too.`)) {
      return;
    }
    await authFetch(`/api/admin/triggers/${trigger.id}/`, { method: "DELETE" });
    fetchTriggers()
      .then(setTriggers)
      .catch(() => setError("Failed to load triggers."));
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notification Settings</h1>
        <Link href="/admin/triggers/new" className="rounded bg-foreground px-3 py-1.5 text-sm text-background">
          + New trigger
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!triggers && !error && <p className="text-sm text-neutral-500">Loading…</p>}

      {triggers && triggers.length === 0 && (
        <p className="text-sm text-neutral-500">No triggers yet — create one to get started.</p>
      )}

      {triggers && triggers.length > 0 && (
        <table className="w-full max-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/15">
              <th className="py-2 pr-4">Trigger</th>
              {CHANNELS.map((c) => (
                <th key={c.key} className="py-2 pr-4">
                  {c.label}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {triggers.map((trigger) => (
              <tr key={trigger.id} className="border-b border-black/5 dark:border-white/10">
                <td className="py-2 pr-4 font-medium">{trigger.display_name}</td>
                {CHANNELS.map((c) => (
                  <td key={c.key} className="py-2 pr-4">
                    <Link
                      href={`/admin/triggers/${trigger.id}/templates/${c.key}`}
                      className="underline"
                    >
                      {cellLabel(trigger, c.key)}
                    </Link>
                  </td>
                ))}
                <td className="py-2">
                  <button onClick={() => handleDelete(trigger)} className="text-red-600 underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
