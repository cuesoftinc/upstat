"use client";

import { clsx } from "clsx";

/** Google 'G' — approved brand glyph (design.md §8.1), NOT Lucide.
 *  Official Google brand colors are a documented raw-hex exception. */
function GoogleGlyph() {
  return (
    <svg
      viewBox="0 0 18 18"
      aria-hidden="true"
      style={{ width: 18, height: 18 }}
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export interface GoogleAuthButtonProps {
  onClick?: () => void;
  /** loading state — "Connecting…" with the glyph swapped for a spinner. */
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * GoogleAuthButton — the product's single auth CTA (X-1; design.md §8.2b:
 * default / hover / loading). Same name in every CueLABS™ product.
 * Google brand button colors are brand-mandated raw values (white /
 * #1F1F1F / #D9D9D9 — Figma 92:1449), NOT token-bound, in both modes.
 */
export function GoogleAuthButton({
  onClick,
  loading = false,
  disabled = false,
  className,
}: GoogleAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className={clsx(
        "font-ui inline-flex h-9 w-full items-center justify-center gap-[var(--space-3)]",
        // raw values: the token theme resets Tailwind's default palette,
        // so bg-white does not exist — use arbitrary values
        "rounded-(--radius) border border-[#D9D9D9] bg-[#FFFFFF] px-[var(--space-4)]",
        "text-[14px] font-medium text-[#1F1F1F]",
        "transition-colors duration-[var(--duration-fast)] ease-standard",
        "hover:bg-[#F5F5F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed",
        !loading && "disabled:opacity-60", // loading is busy, not dimmed (Figma 92:1448)
        className,
      )}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="inline-block size-4 animate-spin rounded-full border-2 border-[#D9D9D9] border-t-brand-deep motion-reduce:animate-none"
        />
      ) : (
        <GoogleGlyph />
      )}
      <span>{loading ? "Signing in…" : "Continue with Google"}</span>
    </button>
  );
}
