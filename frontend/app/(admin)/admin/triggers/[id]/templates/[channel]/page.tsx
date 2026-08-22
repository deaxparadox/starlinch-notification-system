"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

import { useAuth } from "@/lib/auth";
import type { Channel, Trigger } from "@/lib/types";

const CHANNEL_LABELS: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  webpush: "Web Push",
};

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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  const [testRecipient, setTestRecipient] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);
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
    setSaveState("saving");
    setSaveError("");
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
    if (!res.ok) {
      setSaveState("error");
      setSaveError("Failed to save template.");
      return;
    }
    setSaveState("saved");
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
    setTestResult(JSON.stringify(data));
    setTesting(false);
  }

  if (loadError) return <p className="p-8 text-sm text-red-600">{loadError}</p>;
  if (!trigger) return <p className="p-8 text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <Link href="/admin" className="text-sm underline">
        ← Back to triggers
      </Link>
      <h1 className="text-xl font-semibold">
        {trigger.display_name} — {CHANNEL_LABELS[channel]}
      </h1>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => handleToggle(e.target.checked)} />
        Active
      </label>

      <div className="flex max-w-md flex-col gap-3">
        {channel === "whatsapp" ? (
          <>
            <label className="flex flex-col gap-1 text-sm">
              Meta template name
              <input
                value={waTemplateName}
                onChange={(e) => setWaTemplateName(e.target.value)}
                className="rounded border border-black/15 px-3 py-2 dark:border-white/20"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Language code
              <input
                value={waLanguageCode}
                onChange={(e) => setWaLanguageCode(e.target.value)}
                className="rounded border border-black/15 px-3 py-2 dark:border-white/20"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Variables (comma-separated, ordered — e.g. <code>name, login_time</code>)
              <input
                value={waVariableMapping}
                onChange={(e) => setWaVariableMapping(e.target.value)}
                className="rounded border border-black/15 px-3 py-2 dark:border-white/20"
              />
            </label>
          </>
        ) : (
          <>
            {channel === "email" && (
              <label className="flex flex-col gap-1 text-sm">
                Subject
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="rounded border border-black/15 px-3 py-2 dark:border-white/20"
                />
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Body ({"{{ variable }}"} supported)
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="rounded border border-black/15 px-3 py-2 dark:border-white/20"
              />
            </label>
          </>
        )}

        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className="w-fit rounded bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50"
        >
          {saveState === "saving" ? "Saving…" : "Save template"}
        </button>
        {saveState === "saved" && <p className="text-sm text-green-600">Saved.</p>}
        {saveState === "error" && <p className="text-sm text-red-600">{saveError}</p>}
      </div>

      <div className="mt-4 flex max-w-md flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/15">
        <h2 className="text-sm font-semibold">Test send</h2>
        <input
          value={testRecipient}
          onChange={(e) => setTestRecipient(e.target.value)}
          placeholder={channel === "email" ? "you@example.com" : channel === "whatsapp" ? "+1555..." : "onesignal player id"}
          className="rounded border border-black/15 px-3 py-2 text-sm dark:border-white/20"
        />
        <button
          onClick={handleTestSend}
          disabled={testing || !testRecipient}
          className="w-fit rounded border border-black/20 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-white/25"
        >
          {testing ? "Sending…" : "Test send"}
        </button>
        {testResult && <pre className="whitespace-pre-wrap text-xs text-neutral-500">{testResult}</pre>}
      </div>
    </div>
  );
}
