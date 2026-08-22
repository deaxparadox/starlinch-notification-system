import type { SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";
import { fieldBase } from "@/components/ui/input";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "border-border", className)} {...props}>
      {children}
    </select>
  );
}
