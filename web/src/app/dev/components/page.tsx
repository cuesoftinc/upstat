import { notFound } from "next/navigation";
import { ComponentGallery } from "./gallery";

// Dev-only component gallery for the stage QA loops — every §8.2/§8.2b
// component in its variants, dark then light. Hidden from production
// builds unless TEST_MODE (sandbox deployments run TEST_MODE, so the
// gallery stays visible there by design — the org canon, apparule pattern).
export const metadata = { title: "Component gallery — Upstat dev" };

export default function DevComponentsPage() {
  // both flags inline at build time (NEXT_PUBLIC_*, setup.md)
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_TEST_MODE !== "1"
  ) {
    notFound();
  }
  return <ComponentGallery />;
}
