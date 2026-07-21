import { afterEach, describe, expect, it, vi } from "vitest";
import { lazy } from "react";
import { act, render, screen } from "@testing-library/react";
import { createHydrationGate, gated, Defer } from "./Defer";

const Band = () => <p>band content</p>;

/** A gated lazy child, the HomeView wiring in miniature. */
const gatedBand = (gate: ReturnType<typeof createHydrationGate>) =>
  lazy(() =>
    gated(gate, () => Promise.resolve(Band))().then((C) => ({ default: C })),
  );

describe("Defer (gated on-visible hydration — perf audit 2026-07-21)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("releases immediately where IntersectionObserver is unavailable (jsdom)", async () => {
    const gate = createHydrationGate();
    const Lazy = gatedBand(gate);
    render(
      <Defer gate={gate}>
        <Lazy />
      </Defer>,
    );
    expect(await screen.findByText("band content")).toBeInTheDocument();
  });

  it("holds the gate until the band intersects, then hydrates", async () => {
    let intersect: (() => void) | null = null;
    class FakeObserver {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        intersect = () => cb([{ isIntersecting: true }]);
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", FakeObserver);

    const gate = createHydrationGate();
    const Lazy = gatedBand(gate);
    const { container } = render(
      <Defer gate={gate}>
        <Lazy />
      </Defer>,
    );

    // the gate is closed: the lazy child must not resolve
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByText("band content")).toBeNull();
    expect(
      container.querySelector('[data-hydration="deferred"]'),
    ).not.toBeNull();

    await act(async () => {
      intersect?.();
    });
    expect(await screen.findByText("band content")).toBeInTheDocument();
    expect(
      container.querySelector('[data-hydration="released"]'),
    ).not.toBeNull();
  });

  it("gated() loads directly on the server (no visibility to wait for)", async () => {
    // simulate the server: gated must not wait on the gate when window is
    // absent — a stalled gate would hang SSR streaming forever
    const gate = createHydrationGate();
    const load = vi.fn().mockResolvedValue(Band);
    const g = gated(gate, load);
    const win = globalThis.window;
    vi.stubGlobal("window", undefined);
    try {
      await expect(g()).resolves.toBe(Band);
    } finally {
      vi.stubGlobal("window", win);
    }
    expect(load).toHaveBeenCalledTimes(1);
  });
});
