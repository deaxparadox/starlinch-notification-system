import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-16 text-center">
      <h1 className="text-xl font-semibold">Not authorized</h1>
      <p className="max-w-md text-sm text-neutral-500">
        You&apos;re logged in, but this account doesn&apos;t have admin access.
      </p>
      <Link href="/" className="text-sm underline">
        Back to home
      </Link>
    </div>
  );
}
