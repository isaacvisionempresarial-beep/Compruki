import { cx } from "@/lib/cx";

export function Mark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill={onDark ? "#39415C" : "#222638"} />
      <path fill="#25C7A5" d="M8 21h3.4v-6.2H8V21Zm6.3 0h3.4V9.2h-3.4V21Zm6.3 0H24v-4.4h-3.4V21Z" />
    </svg>
  );
}

export function Wordmark({ onDark = false, badge = false, className }: { onDark?: boolean; badge?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", onDark ? "text-on-dark" : "text-ink", className)}>
      <Mark className="h-7 w-7 shrink-0" onDark={onDark} />
      <span className="text-sm font-extrabold tracking-tight">COMPRUKI</span>
      {badge ? (
        <span className="rounded-[8px] bg-accent px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-primary-dark">V1.2</span>
      ) : null}
    </span>
  );
}
