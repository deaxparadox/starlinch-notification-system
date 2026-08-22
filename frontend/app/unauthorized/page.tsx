import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-16 text-center">
      <div className="flex size-10 items-center justify-center rounded-radius-full bg-error-bg text-error">
        <ShieldAlert className="size-5" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold text-foreground">Not authorized</h1>
      <p className="max-w-md text-sm text-foreground-muted">
        You&apos;re logged in, but this account doesn&apos;t have admin access.
      </p>
      <Link href="/" className={buttonVariants("secondary", "md")}>
        Back to home
      </Link>
    </div>
  );
}
