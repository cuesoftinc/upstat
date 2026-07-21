"use client";

import {
  Suspense,
  useEffect,
  useRef,
  type ComponentType,
  type ReactNode,
} from "react";

/**
 * On-visible hydration for below-fold marketing bands (perf audit
 * 2026-07-21: hydrating the whole landing eagerly burnt ~1.8s of mobile
 * main-thread time in one chunk — TBT 772ms live).
 *
 * How it works — React-native selective hydration, gated on visibility:
 * every band SSRs normally (full markup in the HTML; seo.spec/home.spec
 * assert it) inside a `<Suspense>` boundary whose `next/dynamic` loader
 * waits on a {@link HydrationGate} — ON THE CLIENT ONLY (the server loads
 * the module directly, so streaming never stalls). While the gate is
 * closed the lazy child stays pending, so React leaves the boundary
 * DEHYDRATED: the server DOM stays on screen untouched and none of the
 * band's hydration work runs. When the band approaches the viewport the
 * wrapper releases the gate; the chunk resolves and React retries and
 * hydrates the boundary in place — no re-render, no fallback flash.
 *
 * THE CONTRACT (all three parts matter — regressions nuke bands to an
 * empty fallback):
 * 1. Defer never re-renders: any update reaching a dehydrated boundary
 *    forces React to abandon the server DOM and client-render the
 *    fallback. The released marker is set imperatively on the DOM node,
 *    not via state.
 * 2. Band elements are identity-stable in the parent (HomeView memoizes
 *    the below-fold fragment), so parent re-renders — the hero crosshair
 *    rAF loop, the post-mount demo rebuild — bail out above the boundary.
 * 3. A band hydrates against the EXACT markup it server-rendered: bands
 *    that consume the seeded demo dataset own the epoch→live swap
 *    internally (first client render = the deterministic epoch build, a
 *    post-mount effect refreshes to the live clock — the useHomeDemoData
 *    contract), because hydration may run minutes after load.
 *
 * (The react-lazy-hydration `dangerouslySetInnerHTML` trick was tried
 * first and is NOT viable on React 19 — hydration silently discards the
 * server DOM on the mismatch, which collapses every band and re-renders
 * the whole page eagerly.)
 *
 * Environments without IntersectionObserver (jsdom) release immediately.
 */

export interface HydrationGate {
  /** Resolves once the gate is released (client loaders await this). */
  promise: Promise<void>;
  /** Opens the gate; idempotent. */
  release: () => void;
}

export function createHydrationGate(): HydrationGate {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/**
 * Wraps a `next/dynamic` loader so the CLIENT waits for the band's gate
 * while the SERVER imports directly (SSR must never wait on visibility).
 */
export function gated<P>(
  gate: HydrationGate,
  load: () => Promise<ComponentType<P>>,
): () => Promise<ComponentType<P>> {
  return () =>
    typeof window === "undefined" ? load() : gate.promise.then(load);
}

export interface DeferProps {
  /** The gate the band's lazy loader waits on — released on visibility. */
  gate: HydrationGate;
  children: ReactNode;
  /**
   * IntersectionObserver lead distance: release this far before the band
   * enters the viewport so handlers are live by the time it's reachable.
   */
  rootMargin?: string;
  className?: string;
}

export function Defer({
  gate,
  children,
  rootMargin = "256px 0px",
  className,
}: DeferProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const release = () => {
      gate.release();
      // imperative marker (e2e/debug hook) — deliberately NOT React state;
      // see contract point 1 in the module docblock
      node.setAttribute("data-hydration", "released");
    };
    if (typeof IntersectionObserver === "undefined") {
      release();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          release();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [gate, rootMargin]);

  return (
    <div ref={ref} data-hydration="deferred" className={className}>
      {/* no fallback on purpose: during hydration the boundary holds the
          server DOM while dehydrated; a fallback only ever renders on a
          fresh client-side mount, where the band assembles on approach */}
      <Suspense>{children}</Suspense>
    </div>
  );
}
