"use client";

import { useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { GradientHero } from "@/components/ui/gradient-hero";
import { FieldError, FieldLabel, Input, Textarea } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

/** DRF validation errors come back as {field: [messages]}. Render them readably instead of
 * dumping raw JSON; fall back to a generic message if the shape doesn't match. */
function parseApiError(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) return null;
  const lines = entries.map(([field, messages]) => {
    const text = Array.isArray(messages) ? messages.join(" ") : String(messages);
    return field === "detail" ? text : `${field}: ${text}`;
  });
  return lines.join(" ");
}

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
        const data = await res.json().catch(() => null);
        throw new Error(parseApiError(data) || "Failed to create trigger.");
      }
      router.push("/admin/triggers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create trigger.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <GradientHero size="reduced">
        <Link href="/admin/triggers" className="text-sm text-foreground-secondary hover:text-foreground">
          ← Back to triggers
        </Link>
        <h1 className="mt-2 text-[28px] font-extrabold text-foreground">New trigger</h1>
      </GradientHero>

      <div className="mx-auto w-full max-w-2xl px-12 pb-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>
              Key (e.g. <code className="font-mono normal-case">login</code>)
            </FieldLabel>
            <Input value={key} onChange={(e) => setKey(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Display name</FieldLabel>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Description</FieldLabel>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" loading={submitting} className="w-fit">
            {submitting ? "Creating…" : "Create trigger"}
          </Button>
        </form>
      </div>
    </div>
  );
}
