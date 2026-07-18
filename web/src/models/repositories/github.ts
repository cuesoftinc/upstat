import { TEST_MODE } from "./client";

/**
 * GitHub star count — pages.md A13 / MarketingNav as-built note: the badge
 * is neutral ("Star") in static designs; a live count is populated at
 * runtime only. Third-party fetch, so it lives in the models layer (the
 * only layer that talks to the network).
 *
 * TEST_MODE: the API-client seam points all model-layer network at the
 * in-app mock server — a third-party origin has no mock surface, so the
 * repo resolves `null` without touching the network (badge stays neutral;
 * Playwright/CI stay hermetic).
 */
export const githubRepo = {
  async stars(repo = "cuesoftinc/upstat"): Promise<number | null> {
    if (TEST_MODE) return null;
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { accept: "application/vnd.github+json" },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { stargazers_count?: number };
      return typeof body.stargazers_count === "number" ? body.stargazers_count : null;
    } catch {
      return null;
    }
  },
};
