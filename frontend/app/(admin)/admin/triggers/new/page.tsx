"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/lib/auth";

export default function NewTriggerPage() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [key, setKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await authFetch("/api/admin/triggers/", {
        method: "POST",
        body: JSON.stringify({ key, display_name: displayName, description }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(data));
      }
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trigger.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Link href="/admin" className="text-sm underline">
        ← Back to triggers
      </Link>
      <h1 className="text-xl font-semibold">New trigger</h1>
      <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Key (e.g. <code>login</code>)
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="rounded border border-black/15 px-3 py-2 dark:border-white/20"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded border border-black/15 px-3 py-2 dark:border-white/20"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded border border-black/15 px-3 py-2 dark:border-white/20"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create trigger"}
        </button>
      </form>
    </div>
  );
}
