/**
 * Small, generic display-formatting helpers shared across reviewer-side
 * pages (confirmed 2026-08-26, navigation-audit fix batch, item 2) — this
 * is deliberately NOT a place to add page-specific formatting logic; it
 * exists only for the two things multiple reviewer pages independently
 * needed and had no single source of truth for.
 */

/**
 * Generic snake_case-enum -> human sentence-case fallback, e.g.
 * "pending_review" -> "Pending review", "in_progress" -> "In progress".
 *
 * This is deliberately the *fallback*, not a replacement for a more
 * considered label map where one already exists (GOAL_LABELS for goal
 * keys, SESSION_STATUS_LABELS below for session-request status, module
 * labels for module_type) — those stay their own maps since they carry
 * real, hand-written context a blind transform can't. This exists for the
 * many report/module/sprint/task status enums that never got one and were
 * previously shown to reviewers completely raw.
 */
export function humanizeStatus(value: string): string {
  if (!value) return value;
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Session-request status labels (extracted 2026-08-26 from
 * `(app)/reports/page.tsx`, where this map originated, into a shared
 * location so `/company/[companyId]` and `/queue` can reuse the exact same
 * considered copy instead of falling back to the generic humanizer or
 * inventing their own — "requested" specifically benefits from the real
 * "— awaiting scheduling" context a blind transform can't provide).
 */
export const SESSION_STATUS_LABELS: Record<string, string> = {
  requested: "Requested — awaiting scheduling",
  scheduled: "Scheduled",
  completed: "Completed",
  declined: "Declined",
};
