import type { Metadata } from "next";
import { HomeView } from "@/components/home/HomeView";

/**
 * / — public home (pages.md Part A; Figma landing v2 frame 135:2, W2).
 * Server shell carries the route metadata; the view is client-composed
 * from the registry via the home controller.
 */

const TITLE = "Upstat — all your telemetry, one open platform";
const DESCRIPTION =
  "Uptime, RUM, metrics, logs, traces, dashboards, alerts, SLOs and status pages — one open-source platform, OTel-native and ClickHouse-fast.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://upstat.cuesoft.io",
    siteName: "Upstat",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function Home() {
  return <HomeView />;
}
