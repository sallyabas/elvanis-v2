import { getSettingNumber } from "@/lib/app-settings";

/**
 * Shared SLA constant (confirmed 2026-08-06, honest UX review pass) —
 * previously a local const duplicated only inside EvidenceIntakeForm.tsx,
 * which meant the client report page's "still being reviewed" holding
 * copy had no way to reference it and instead hardcoded "72 hours"
 * directly. That hardcoded string could silently diverge from the real
 * total the confirmation modal computes from the DB-backed
 * edit_window_hours setting (e.g. it would still say "72 hours" even
 * after edit_window_hours was changed to 48, when the real total is 96)
 * — the exact class of copy/value divergence bug this codebase has
 * fixed everywhere else. Extracted here so both surfaces read the same
 * value.
 *
 * Still intentionally a fixed constant, not DB-backed — unlike
 * edit_window_hours, it has no enforcement mechanism anywhere in code
 * (confirmed: "exists only as narrative, never an enforced deadline"),
 * so migrating it to app_settings now would let the copy promise a
 * number nothing actually holds to. Only promote it to a DB setting
 * alongside building real enforcement for it — a separate, deliberate
 * decision, not a side effect of this fix.
 */
export const REVIEW_PERIOD_HOURS = 48;

/** Total client-facing turnaround promise: edit window + review period, both derived from the same source every surface reads. */
export async function getTotalTurnaroundHours(): Promise<{ editWindowHours: number; totalHours: number }> {
  const editWindowHours = await getSettingNumber("edit_window_hours", 24);
  return { editWindowHours, totalHours: editWindowHours + REVIEW_PERIOD_HOURS };
}
