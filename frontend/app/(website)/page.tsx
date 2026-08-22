import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <h1 className="text-2xl font-semibold">Starclinch Notification System</h1>
      <p className="max-w-md text-sm text-neutral-500">
        Placeholder home page — the real login/logout flow is built in FEAT-20260822-1216.
      </p>
      <Link href="/login" className="text-sm underline">
        Go to login
      </Link>
    </div>
  );
}
