export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="border-b border-black/10 px-6 py-4 text-sm dark:border-white/15">
        Starclinch Notification System
      </nav>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
