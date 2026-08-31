"use client";

/**
 * Shared filter-chip button (confirmed 2026-08-31) — extracted from
 * SignalsClient.tsx's own inline chip markup (built 2026-08-16) so Reports
 * & History's new type filter (sidebar rework, item 7) can reuse the exact
 * same visual component, not a re-implementation that could drift. The
 * caller owns the active/inactive state and the per-chip active color
 * (each page's own category color system — Signals uses lens/module
 * colors, Reports & History uses item-type-badge's colors — stay separate
 * concerns from this component, which only renders the toggle itself).
 */
export function FilterChip({ label, active, activeClassName, onClick }: { label: string; active: boolean; activeClassName: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border border-transparent px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
        active ? activeClassName : "border-neutral-300 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
      }`}
    >
      {label}
    </button>
  );
}
