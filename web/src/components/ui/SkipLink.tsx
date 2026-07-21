/**
 * SkipLink — fleet canon (P15): the first focusable element in the shell,
 * visually hidden until keyboard focus, jumps past the chrome to the
 * `#main` landmark (which carries tabIndex={-1} so focus follows).
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[var(--z-overlay)] focus:rounded-(--radius) focus:border focus:border-border focus:bg-bg-elev focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-text"
    >
      Skip to content
    </a>
  );
}
