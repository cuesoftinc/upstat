export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-[var(--space-3)]">
      <h2 className="border-b border-border pb-[var(--space-2)] text-[16px] font-semibold text-text">
        {title}
      </h2>
      <div className="flex flex-wrap items-start gap-[var(--space-4)]">
        {children}
      </div>
    </section>
  );
}

export function Cell({
  label,
  grow = false,
  children,
}: {
  label: string;
  grow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        grow
          ? "flex min-w-72 grow basis-[420px] flex-col gap-[var(--space-2)]"
          : "flex flex-col gap-[var(--space-2)]"
      }
    >
      <span className="font-data text-[11px] text-text-2">{label}</span>
      <div>{children}</div>
    </div>
  );
}
