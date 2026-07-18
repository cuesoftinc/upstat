import "@testing-library/jest-dom/vitest";

// jsdom gaps for the Radix primitives (W2 convergence): Floating-UI-based
// content (Tooltip/Popover) measures with ResizeObserver, and Radix's
// dismissable layers probe pointer-capture APIs that jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => undefined;
  Element.prototype.releasePointerCapture ??= () => undefined;
  Element.prototype.scrollIntoView ??= () => undefined;
}
