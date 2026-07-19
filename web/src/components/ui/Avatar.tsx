"use client";

import { clsx } from "clsx";

export interface AvatarProps {
  name: string;
  /** 20 / 24px (§8.2b). */
  size?: 20 | 24;
  src?: string;
  className?: string;
}

const PALETTE = [
  "bg-series-1",
  "bg-series-2",
  "bg-series-5",
  "bg-series-8",
  "bg-series-4",
];

function tintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Avatar — image / initials fallback, 20/24px (§8.2b). */
export function Avatar({ name, size = 24, src, className }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      title={name}
      style={{ width: size, height: size }}
      className={clsx(
        "font-ui inline-flex shrink-0 select-none items-center justify-center overflow-hidden",
        "rounded-full border border-border text-[10px] font-semibold text-bg",
        !src && tintFor(name),
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar URLs are external/user content
        <img src={src} alt={name} width={size} height={size} className="size-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

export interface AvatarStackProps {
  names: string[];
  size?: 20 | 24;
  /** Stack renders up to this many, then a "+n" overflow chip (§8.2b). */
  max?: number;
  className?: string;
}

/** AvatarStack — ×2–5 + “+n” overflow (§8.2b). */
export function AvatarStack({ names, size = 20, max = 5, className }: AvatarStackProps) {
  const visible = names.slice(0, max);
  const overflow = names.length - visible.length;
  return (
    <span className={clsx("inline-flex items-center", className)}>
      {visible.map((name, i) => (
        <span key={name} className={clsx(i > 0 && "-ml-1.5")}>
          <Avatar name={name} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <span
          style={{ width: size, height: size }}
          className="font-ui -ml-1.5 inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-bg-elev text-[10px] font-medium text-text-2"
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
