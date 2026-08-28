import type { ReactNode } from "react";

/**
 * Shared card container (confirmed 2026-08-07) — every page in this app
 * built its own `rounded-lg border border-neutral-200 bg-white p-5...`
 * one-off, close enough to look similar but never actually shared, so
 * padding/spacing drifted page to page. One real component now.
 *
 * Extended 2026-08-28 (premium B2B redesign, spec point 2) with a real
 * three-level elevation system, replacing the flat `border + shadow-sm`
 * treatment — `level` defaults to 1 (an ordinary card) so every existing
 * call site is unaffected unless it opts into 2 (a highlighted/priority
 * card) or 3 (an active/selected card). Border color is unchanged
 * (`border-neutral-200`, now recolored to the spec's own #e8e8e8 by the
 * palette remap in globals.css) — levels 2/3 add a copper left-border
 * accent on top of it, per the spec's own description, rather than
 * removing the base border.
 */
const LEVEL_STYLES: Record<1 | 2 | 3, string> = {
  1: "shadow-card-1 border-neutral-200 dark:border-neutral-800",
  2: "shadow-card-2 border-neutral-200 border-l-4 border-l-accent dark:border-neutral-800 dark:border-l-accent",
  3: "shadow-card-3 border-neutral-200 border-l-[3px] border-l-accent dark:border-neutral-800 dark:border-l-accent",
};

export function Card({
  title,
  subtitle,
  level = 1,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  /** Elevation level (spec point 2): 1 = default, 2 = highlighted/priority, 3 = active/selected. */
  level?: 1 | 2 | 3;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border bg-white p-6 dark:bg-neutral-900 ${LEVEL_STYLES[level]} ${className ?? ""}`}>
      {title && <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">{title}</h2>}
      {subtitle && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
      <div className={title || subtitle ? "mt-4" : ""}>{children}</div>
    </section>
  );
}
