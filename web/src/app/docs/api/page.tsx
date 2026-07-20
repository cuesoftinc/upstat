import type { Metadata } from "next";
import { DocsApiView } from "@/components/docs/DocsApiView";

/**
 * /docs/api — public API reference (X-2): the Scalar interactive
 * reference rendered from the repo's canonical OpenAPI document
 * (docs/api/openapi.yaml, served at /docs/api/openapi.yaml).
 * Production surface: public, no auth, marketing nav chrome. Server
 * shell carries the route metadata; the view is client-composed.
 */

const TITLE = "API reference — Upstat";
const DESCRIPTION =
  "Interactive reference for the Upstat HTTP API — events ingestion, stats, query and alerts, rendered live from the repo's OpenAPI document.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
};

export default function DocsApiPage() {
  return <DocsApiView />;
}
