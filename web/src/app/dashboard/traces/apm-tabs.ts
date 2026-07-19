import type { PageTab } from "../page-tabs";

/** The three B5 views share one tab strip (Figma 227:11752 et al.). */
export function apmTabs(active: "services" | "traces" | "map"): PageTab[] {
  return [
    { label: "Services", href: "/dashboard/traces", active: active === "services" },
    { label: "Traces", href: "/dashboard/traces/explorer", active: active === "traces" },
    { label: "Service map", href: "/dashboard/traces/map", active: active === "map" },
  ];
}
