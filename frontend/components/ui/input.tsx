import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const fieldBase =
  "w-full rounded-radius-sm border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:opacity-50 disabled:pointer-events-none";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error, className, ...props }: InputProps) {
  return (
    <input
      className={cn(fieldBase, error ? "border-error" : "border-border", className)}
      aria-invalid={error || undefined}
      {...props}
    />
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error, className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(fieldBase, error ? "border-error" : "border-border", className)}
      aria-invalid={error || undefined}
      {...props}
    />
  );
}

export function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-xs text-error mt-1">{children}</p>;
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium uppercase tracking-wide text-foreground-secondary">
      {children}
    </label>
  );
}
