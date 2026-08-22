"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { FieldLabel, Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth";
import type { Channel, Trigger } from "@/lib/types";

const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  webpush: "Web Push",
};

interface SendResult {
  status: "sent" | "failed";
  error?: string;
}

export default function TemplateEditorPage() {
  const params = useParams<{ id: string; channel: Channel }>();
  const { id, channel } = params;
  const { authFetch } = useAuth();

  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [loadError, setLoadError] = useState("");

  // Email / Web Push fields
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // WhatsApp fields
  const [waTemplateName, setWaTemplateName] = useState("");
  const [waLanguageCode, setWaLanguageCode] = useState("en_US");
  const [waVariableMapping, setWaVariableMapping] = useState("");

  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);

  const [testRecipient, setTestRecipient] = useState("");
  const [testResult, setTestResult] = useState<SendResult | null>(null);
  const [testing, setTesting] = useState(false);

  const fetchTrigger = useCallback(async (): Promise<Trigger> => {
    const res = await authFetch(`/api/admin/triggers/${id}/`);
    if (!res.ok) throw new Error("Failed to load trigger.");
    return res.json();
  }, [authFetch, id]);

  useEffect(() => {
    fetchTrigger()
      .then((data) => {
        setTrigger(data);
        const template = data.templates[channel];
        if (template) {
          setSubject(template.subject);
          setBody(template.body);
          setWaTemplateName(template.wa_template_name);
          setWaLanguageCode(template.wa_language_code || "en_US");
          setWaVariableMapping(template.wa_variable_mapping.join(", "));
          setIsActive(template.is_active);
        }
      })
      .catch(() => setLoadError("Failed to load trigger."));
  }, [fetchTrigger, channel]);

  async function handleSave() {
    setSaving(true);
    const payload =
      channel === "whatsapp"
        ? {
            wa_template_name: waTemplateName,
            wa_language_code: waLanguageCode,
            wa_variable_mapping: waVariableMapping
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : { subject, body };

    const res = await authFetch(`/api/admin/triggers/${id}/templates/${channel}/`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save template.");
      return;
    }
    toast.success("Template saved.");
  }

  async function handleToggle(next: boolean) {
    setIsActive(next);
    await authFetch(`/api/admin/triggers/${id}/templates/${channel}/toggle/`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: next }),
    });
  }

  async function handleTestSend() {
    setTesting(true);
    setTestResult(null);
    const res = await authFetch(`/api/admin/triggers/${id}/templates/${channel}/test-send/`, {
      method: "POST",
      body: JSON.stringify({ recipient: testRecipient }),
    });
    const data = await res.json().catch(() => ({}));
    setTestResult(data[channel] ?? { status: "failed", error: "No response from server." });
    setTesting(false);
  }

  if (loadError) return <p className="p-8 text-sm text-error">{loadError}</p>;
  if (!trigger) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 p-8">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-8">
      <Link href="/admin/triggers" className="text-sm text-foreground-secondary hover:text-foreground">
        ← Back to triggers
      </Link>
      <h1 className="text-lg font-semibold text-foreground">
        {trigger.display_name} — {CHANNEL_LABELS[channel]}
      </h1>

      <div className="flex items-center gap-2">
        <Switch checked={isActive} onCheckedChange={handleToggle} label="Active" />
        <span className="text-sm text-foreground-secondary">Active</span>
      </div>

      <div className="flex flex-col gap-4">
        {channel === "whatsapp" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Meta template name</FieldLabel>
              <Input value={waTemplateName} onChange={(e) => setWaTemplateName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Language code</FieldLabel>
              <Input value={waLanguageCode} onChange={(e) => setWaLanguageCode(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Variables (ordered, comma-separated)</FieldLabel>
              <Input
                value={waVariableMapping}
                onChange={(e) => setWaVariableMapping(e.target.value)}
                placeholder="name, login_time"
              />
            </div>
          </>
        ) : (
          <>
            {channel === "email" && (
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Subject</FieldLabel>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Body ({"{{ variable }}"} supported)</FieldLabel>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
            </div>
          </>
        )}

        <Button onClick={handleSave} loading={saving} className="w-fit">
          {saving ? "Saving…" : "Save template"}
        </Button>
      </div>

      <div className="mt-2 flex flex-col gap-3 border-t border-border-subtle pt-5">
        <h2 className="text-sm font-semibold text-foreground">Test send</h2>
        <Input
          value={testRecipient}
          onChange={(e) => setTestRecipient(e.target.value)}
          placeholder={
            channel === "email" ? "you@example.com" : channel === "whatsapp" ? "+1555…" : "onesignal player id"
          }
        />
        <Button
          variant="secondary"
          onClick={handleTestSend}
          loading={testing}
          disabled={!testRecipient}
          className="w-fit"
        >
          {testing ? "Sending…" : "Test send"}
        </Button>
        {testResult && (
          <div className="flex flex-col gap-1">
            <StatusBadge status={testResult.status === "sent" ? "success" : "error"}>
              {testResult.status === "sent" ? "Sent" : "Failed"}
            </StatusBadge>
            {testResult.error && <p className="text-xs text-foreground-muted">{testResult.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
