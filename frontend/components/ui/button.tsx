"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground rounded-full hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "bg-transparent text-foreground-secondary border border-border rounded-full hover:border-border-strong hover:text-foreground",
  destructive: "bg-error text-white rounded-md hover:opacity-90",
  ghost: "bg-transparent text-foreground-secondary rounded-md hover:bg-surface-muted hover:text-foreground",
};

const sizes: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-2",
};

/** For applying Button's visual style to a non-<button> element (e.g. next/link's <Link>,
 * which can't be a descendant of a real <button>). */
export function buttonVariants(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
