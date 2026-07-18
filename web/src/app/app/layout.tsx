/**
 * /app — root of the new observability IA (pages.md Part B). The legacy
 * /dashboard/* routes stay live untouched until W3 replaces them.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-ui min-h-screen bg-bg text-text">
      {children}
    </div>
  );
}
