/**
 * Public status page chrome — pages.md B7: `status.upstat.cuesoft.io/{slug}`
 * rewrites onto `/status/{slug}`; unauthenticated, LIGHT mode, deliberately
 * outside the /dashboard shell (a separate entry point, design.md §8.4).
 */
export default function StatusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-theme="light" className="font-ui min-h-screen bg-bg text-text">
      {children}
    </div>
  );
}
