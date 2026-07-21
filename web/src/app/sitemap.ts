import type { MetadataRoute } from "next";

/**
 * Public marketing surface only (SEO plumbing, fleet canon): the home
 * page, the public Scalar API reference, and upstat's own public status
 * page (the dogfood instance — live 200 unauthenticated). Auth (/signin)
 * and app (/dashboard/*) routes stay out by design; customer /status/*
 * pages are runtime content, not build-time sitemap entries.
 */
const BASE = "https://upstat.cuesoft.io";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/docs/api`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/status/upstat`, changeFrequency: "daily", priority: 0.5 },
  ];
}
