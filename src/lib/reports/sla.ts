import { getSettingNumber } from "@/lib/app-settings";

/**
 * Shared SLA constants (confirmed 2026-08-06, honest UX review pass;
 * review_period_hours promoted to DB-backed 2026-08-12) — previously a
 * local const duplicated only inside EvidenceIntakeForm.tsx, which meant
 * the client report page's "still being reviewed" holding copy had no
 * way to reference it and instead hardcoded "72 hours" directly. That
 * hardcoded string could silently diverge from the real total the
 * confirmation modal computes from the DB-backed edit_window_hours
 * setting. Extracted here so both surfaces read the same value.
 *
 * review_period_hours was originally left hardcoded on purpose — this
 * file's own earlier docblock said "migrating it to app_settings now
 * would let the copy promise a number nothing actually holds to... only
 * promote it alongside building real enforcement for it." That's exactly
 * what happened 2026-08-12 (direct founder request): reports.review_due_at
 * is now a real, stamped deadline and the reviewer queue shows a real
 * "Overdue" flag once it passes — so the DB-backed value now describes an
 * actual enforced number, not just a hopeful one.
 */
const DEFAULT_REVIEW_PERIOD_HOURS = 48;

/** Total client-facing turnaround promise: edit window + review period, both derived from the same source every surface reads. */
export async function getTotalTurnaroundHours(): Promise<{ editWindowHours: number; reviewPeriodHours: number; totalHours: number }> {
  const editWindowHours = await getSettingNumber("edit_window_hours", 24);
  const reviewPeriodHours = await getSettingNumber("review_period_hours", DEFAULT_REVIEW_PERIOD_HOURS);
  return { editWindowHours, reviewPeriodHours, totalHours: editWindowHours + reviewPeriodHours };
}
