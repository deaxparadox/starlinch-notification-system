"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LayoutDashboard, ListChecks, LogOut } from "lucide-react";

import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/triggers", label: "Triggers", icon: Bell, exact: false },
  { href: "/admin/logs", label: "Logs", icon: ListChecks, exact: false },
];

export function AdminSidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col gap-1 border-r border-border bg-surface p-3 transition-[width] duration-150",
        collapsed ? "w-[60px] items-center" : "w-[180px]",
      )}
    >
      <div
        className={cn(
          "pb-4 text-sm font-semibold text-foreground",
          collapsed ? "text-center" : "px-2",
        )}
      >
        {collapsed ? "S" : "Starclinch"}
      </div>
      {NAV_ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-2 rounded-radius-sm py-1.5 text-sm font-medium transition-colors",
              collapsed ? "w-9 justify-center px-0" : "w-full px-2",
              active
                ? "bg-primary/10 text-primary"
                : "text-foreground-secondary hover:bg-surface-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {!collapsed && item.label}
          </Link>
        );
      })}
      <div
        className={cn(
          "mt-auto flex flex-col gap-1 border-t border-border-subtle pt-3 text-xs text-foreground-muted",
          collapsed ? "items-center" : "w-full",
        )}
      >
        {!collapsed && <span className="truncate px-2">{user?.username ?? "—"}</span>}
        <Link
          href="/logout"
          title="Log out"
          className={cn(
            "flex items-center gap-2 rounded-radius-sm py-1 hover:bg-surface-muted hover:text-foreground",
            collapsed ? "w-9 justify-center px-0" : "w-full px-2",
          )}
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          {!collapsed && "Log out"}
        </Link>
      </div>
    </aside>
  );
}
