"use client";

import { useEffect, useState, type SubmitEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GradientHero } from "@/components/ui/gradient-hero";
import { FieldError, FieldLabel, Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { subscribeToWebPush } from "@/lib/onesignal";

export default function LoginPage() {
  const { status, login, authFetch } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);

      // Best-effort, never blocks the redirect: a failed/skipped push subscription must not
      // stop a successful login. Only prompts AFTER login succeeds - there's no user to
      // attach the subscription to before that.
      const playerId = await subscribeToWebPush();
      if (playerId) {
        await authFetch("/api/webpush/subscribe/", {
          method: "POST",
          body: JSON.stringify({ onesignal_player_id: playerId }),
        }).catch((err) => console.warn("webpush subscribe registration failed:", err));
      }

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <GradientHero
      size="full"
      padded={false}
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 p-16"
    >
      <h1 className="text-xl font-semibold text-foreground">Login</h1>
      <Card className="w-full max-w-xs p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Username</FieldLabel>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Password</FieldLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" loading={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </Card>
    </GradientHero>
  );
}
