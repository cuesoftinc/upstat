"use client";

import { Button } from "./Button";

export interface RequestErrorProps {
  /** The `error` from a `useRequest` result. */
  error: Error;
  /** The `reload` from the same result; wired to the Try again button. */
  onRetry: () => void;
  /** What failed to load, e.g. "monitor rules". Used in the message. */
  what: string;
  className?: string;
}

/** A 403 from the API means the signed-in member lacks access (not a failure). */
function isForbidden(error: Error): boolean {
  return "status" in error && (error as { status?: unknown }).status === 403;
}

/**
 * Shared load-failure state for pages built on `useRequest`: a no-access
 * message on 403, otherwise an error message with a retry action.
 */
export function RequestError({
  error,
  onRetry,
  what,
  className,
}: RequestErrorProps) {
  const box =
    "flex flex-col items-start gap-3 rounded-(--radius) border border-border bg-bg-elev p-6 text-[13px] text-text-2";

  if (isForbidden(error)) {
    return (
      <div
        role="status"
        data-testid="request-no-access"
        className={[box, className].filter(Boolean).join(" ")}
      >
        <p>You don&apos;t have access to {what}.</p>
        <p>Ask an admin of your organization to change your role.</p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      data-testid="request-error"
      className={[box, className].filter(Boolean).join(" ")}
    >
      <p>Couldn&apos;t load {what}.</p>
      <Button kind="quiet" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
