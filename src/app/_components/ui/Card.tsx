import type { ReactNode } from "react";

/**
 * Shared card container (confirmed 2026-08-07) — every page in this app
 * built its own `rounded-lg border border-neutral-200 bg-white p-5...`
 * one-off, close enough to look similar but never actually shared, so
 * padding/spacing drifted page to page. One real component now.
 */
export function Card({
  title,
  subtitle,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 ${className ?? ""}`}>
      {title && <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">{title}</h2>}
      {subtitle && <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>}
      <div className={title || subtitle ? "mt-4" : ""}>{children}</div>
    </section>
  );
}
