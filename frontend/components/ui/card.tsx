import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-radius-md border border-border bg-surface", className)}>
      {children}
    </div>
  );
}
