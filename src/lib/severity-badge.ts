/**
 * Shared severity-badge styling (confirmed 2026-08-28, premium B2B
 * redesign, spec point 4) — extracted from 6 near-identical copies
 * (Dashboard, Signals, the client Report view, the module detail page,
 * /demo-live, the reviewer /requests table) into one real source of truth,
 * same "single source of truth" discipline already used for
 * TYPE_BADGE_STYLES/GOAL_LABELS/SESSION_STATUS_LABELS elsewhere in this
 * codebase — a structural/organizational change only, no behavior change,
 * since all 6 copies were already byte-identical.
 *
 * Softer, no-border tones per the spec, replacing the previous saturated
 * `bg-*-100 text-*-800` pairing: CRITICAL red-50/600, HIGH orange-50/700,
 * MEDIUM yellow-50/700, LOW green-50/600 — these are Tailwind's own
 * default palette values (red-50 #fef2f2, red-600 #dc2626, orange-50
 * #fff7ed, orange-700 #c2410c, yellow-50 #fefce8, yellow-700 #a16207,
 * green-50 #f0fdf4, green-600 #16a34a all matched the spec's given hexes
 * exactly), so no arbitrary/custom color values were needed.
 */
export const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-yellow-50 text-yellow-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-300",
};
