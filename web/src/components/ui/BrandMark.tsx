"use client";

import { clsx } from "clsx";
import { Zap } from "lucide-react";

export interface BrandMarkProps {
  /** Render the lowercase wordmark beside the bolt. */
  wordmark?: boolean;
  /** Glyph size class (defaults to size-5). */
  glyphClassName?: string;
  className?: string;
}

/**
 * BrandMark — the product mark: filled bolt glyph (+ optional lowercase
 * wordmark). The one brand construction across app chrome, /signin, the
 * public status page, marketing nav and footer (systemic adjudication
 * 2026-07-20 — replaces the green "U" tile everywhere in-app; the Figma
 * canon is the zap + wordmark of frames 124:6 / 132:3530 / 284:2).
 */
export function BrandMark({
  wordmark = false,
  glyphClassName,
  className,
}: BrandMarkProps) {
  return (
    <span
      className={clsx(
        "font-ui inline-flex items-center gap-2 font-semibold text-text",
        className,
      )}
    >
      <Zap
        aria-hidden="true"
        fill="currentColor"
        strokeWidth={0}
        className={clsx("shrink-0 text-brand", glyphClassName ?? "size-5")}
      />
      {wordmark && "upstat"}
    </span>
  );
}
