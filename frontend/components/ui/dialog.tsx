"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type MouseEvent } from "react";

import { cn } from "@/lib/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/** Wraps the native <dialog> element - gives focus trapping, Escape-to-close, and backdrop
 * behavior for free, no extra dependency needed. */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleBackdropClick(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={handleBackdropClick}
      className={cn(
        // Tailwind's preflight resets margin to 0 on every element, which silently kills the
        // native dialog:modal UA stylesheet's `margin: auto` centering - m-auto restores it.
        "m-auto w-full max-w-sm rounded-radius-md border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40",
      )}
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button
          onClick={onClose}
          className="text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-radius-sm"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}
