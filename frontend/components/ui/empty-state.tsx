import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-radius-md border border-dashed border-border py-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-radius-full bg-surface-muted text-foreground-muted">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="max-w-xs text-sm text-foreground-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
