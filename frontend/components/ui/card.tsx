import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-radius-lg bg-surface-warm", className)}>
      {children}
    </div>
  );
}
