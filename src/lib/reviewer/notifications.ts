import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Shared reviewer fan-out (confirmed 2026-08-10, delayed-execution
 * architecture) — notifies every account with role="reviewer" (there can
 * be more than one, per scripts/grant-reviewer.ts) that a report is real
 * and ready, and stamps reviewer_notified_at. Extracted here so
 * run-pending-audits.ts (the new PRIMARY trigger — see its own docblock)
 * and checkAndNotifyClosedEditWindows below (now a backstop, not the
 * primary path) share one real implementation instead of two copies of
 * the same loop.
 */
export async function notifyReviewersOfNewSubmission(supabase: SupabaseClient, reportId: string): Promise<void> {
  const { data: reviewers, error: reviewersError } = await supabase.from("users").select("id").eq("role", "reviewer");
  if (reviewersError) throw new Error(`notifyReviewersOfNewSubmission: failed to load reviewers: ${reviewersError.message}`);

  for (const reviewer of reviewers ?? []) {
    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_type: "reviewer",
      recipient_id: reviewer.id,
      event_type: "new_submission",
      channel: "email",
      sent_at: null, // logged, not actually delivered — a separate, explicit, confirmed step (see dispatch.ts)
    });
    if (notifError) throw new Error(`notifyReviewersOfNewSubmission: failed to log notification: ${notifError.message}`);
  }

  const { error: updateError } = await supabase
    .from("reports")
    .update({ reviewer_notified_at: new Date().toISOString() })
    .eq("id", reportId);
  if (updateError) throw new Error(`notifyReviewersOfNewSubmission: failed to mark notified: ${updateError.message}`);
}

/**
 * Originally: "the reviewer notification must fire the instant the 24h
 * edit window closes" (spec §2.3a, confirmed 2026-07-31).
 *
 * Superseded 2026-08-10 (delayed-execution architecture, direct founder
 * request) — the real trigger is no longer "the window closed," it's "the
 * audit actually finished and there's something real to review." Under
 * the new architecture, `runAudit()` (and therefore a `reports` row) only
 * ever gets created AFTER the window has closed (see run-pending-audits.ts),
 * and that same function now calls notifyReviewersOfNewSubmission() itself
 * immediately once the audit completes — so by the time any `reports` row
 * exists, `reviewer_notified_at` should already be stamped.
 *
 * This function is kept as a harmless, idempotent BACKSTOP, not the
 * primary path anymore: it only ever finds something to do if that inline
 * notify call somehow succeeded at creating the report but failed before
 * stamping reviewer_notified_at — a narrow edge case, cheap to keep
 * covered rather than silently drop. Idempotent: reviewer_notified_at
 * gates re-firing, so calling this repeatedly never double-notifies.
 */
export interface ClosedEditWindowReport {
  reportId: string;
  companyId: string;
}

export async function checkAndNotifyClosedEditWindows(): Promise<ClosedEditWindowReport[]> {
  const supabase = createAdminClient();

  const { data: reports, error } = await supabase
    .from("reports")
    .select("id, company_id")
    .eq("status", "pending_review")
    .is("reviewer_notified_at", null)
    .lte("edit_window_closes_at", new Date().toISOString());

  if (error) throw new Error(`checkAndNotifyClosedEditWindows failed: ${error.message}`);
  if (!reports || reports.length === 0) return [];

  for (const r of reports) {
    await notifyReviewersOfNewSubmission(supabase, r.id as string);
  }

  return reports.map((r) => ({ reportId: r.id as string, companyId: r.company_id as string }));
}
