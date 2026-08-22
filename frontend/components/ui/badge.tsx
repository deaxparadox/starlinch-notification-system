import { cn } from "@/lib/cn";
import type { Channel } from "@/lib/types";

const base = "inline-flex items-center rounded-radius-full border px-2.5 py-0.5 text-xs font-medium";

type Status = "success" | "warning" | "error" | "muted";

const statusStyles: Record<Status, string> = {
  success: "bg-success-bg text-success border-success/30",
  warning: "bg-warning-bg text-warning border-warning/30",
  error: "bg-error-bg text-error border-error/30",
  muted: "bg-surface-muted text-foreground-muted border-border",
};

export function StatusBadge({ status, children }: { status: Status; children: React.ReactNode }) {
  return <span className={cn(base, statusStyles[status])}>{children}</span>;
}

const channelStyles: Record<Channel, string> = {
  whatsapp: "bg-channel-whatsapp-bg text-channel-whatsapp-foreground border-transparent",
  email: "bg-channel-email-bg text-channel-email-foreground border-transparent",
  webpush: "bg-channel-webpush-bg text-channel-webpush-foreground border-transparent",
};

export function ChannelBadge({ channel, children }: { channel: Channel; children: React.ReactNode }) {
  return <span className={cn(base, "font-mono font-semibold", channelStyles[channel])}>{children}</span>;
}
