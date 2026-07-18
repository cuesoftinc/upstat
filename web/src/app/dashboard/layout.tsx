/**
 * /dashboard — root of the new observability IA (pages.md Part B; route
 * standard: all app surfaces live under /dashboard/<area>). The legacy
 * dashboard tree is quarantined in src/legacy/app/dashboard.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-ui min-h-screen bg-bg text-text">
      {children}
    </div>
  );
}
