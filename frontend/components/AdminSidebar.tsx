"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ListChecks } from "lucide-react";

import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/admin", label: "Triggers", icon: Bell },
  { href: "/admin/logs", label: "Logs", icon: ListChecks },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="flex w-[180px] shrink-0 flex-col gap-1 border-r border-border bg-surface p-3">
      <div className="px-2 pb-4 text-sm font-semibold text-foreground">Starclinch</div>
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-radius-sm px-2 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-foreground-secondary hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-auto flex flex-col gap-1 border-t border-border-subtle pt-3 text-xs text-foreground-muted">
        <span className="truncate px-2">{user?.username ?? "—"}</span>
        <Link href="/logout" className="rounded-radius-sm px-2 py-1 hover:bg-surface-muted hover:text-foreground">
          Log out
        </Link>
      </div>
    </aside>
  );
}
