import type { Metadata } from "next";

/**
 * Public status page chrome — pages.md B7: `status.upstat.cuesoft.io/{slug}`
 * rewrites onto `/status/{slug}`; unauthenticated, LIGHT mode, deliberately
 * outside the /dashboard shell (a separate entry point, design.md §8.4).
 */

// Route metadata for the client-composed status page — the one public
// per-org surface, so it must not leak the root fallback title/description
// (2026-07-21 audit).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug} status — Upstat`,
    description: `Live service status, uptime history and incident reports for ${slug}.`,
  };
}

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
