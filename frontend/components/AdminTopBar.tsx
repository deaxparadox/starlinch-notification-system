"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";

interface AdminTopBarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

export function AdminTopBar({ collapsed, onToggleSidebar }: AdminTopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <button
        onClick={onToggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex size-8 items-center justify-center rounded-radius-sm text-foreground-secondary hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {collapsed ? <PanelLeft className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
      </button>
      <span className="text-sm font-medium text-foreground-secondary">Notification System</span>
    </header>
  );
}
