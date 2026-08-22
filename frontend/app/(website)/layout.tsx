export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <nav className="border-b border-border bg-surface px-6 py-4 text-sm font-semibold text-foreground">
        Starclinch
      </nav>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
