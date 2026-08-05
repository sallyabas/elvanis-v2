import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "The reviewer notification must fire the instant the 24h edit window
 * closes" (spec §2.3a, confirmed 2026-07-31). No production cron
 * infrastructure exists yet (Vercel Cron / pg_cron — a separate infra
 * decision) — this is the deterministic, testable CHECK a cron would call
 * on a tick. Idempotent: reviewer_notified_at gates re-firing, so calling
 * this repeatedly (as a real cron would) never double-notifies.
 *
 * Logs to the `notifications` table (a real, durable record) but does NOT
 * send a real outbound email itself — that's a separate, explicit,
 * confirmed step. Firing real email as an automatic side effect of a
 * timing check isn't something this function should do silently.
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

  // Notifies every reviewer, not a single hardcoded one — reviewer access
  // is granted per-email via scripts/grant-reviewer.ts (confirmed
  // 2026-08-02) and there can be more than one, so every account with
  // role="reviewer" gets its own notification row.
  const { data: reviewers, error: reviewersError } = await supabase.from("users").select("id").eq("role", "reviewer");
  if (reviewersError) throw new Error(`checkAndNotifyClosedEditWindows: failed to load reviewers: ${reviewersError.message}`);

  const notifiedAt = new Date().toISOString();

  for (const r of reports) {
    for (const reviewer of reviewers ?? []) {
      const { error: notifError } = await supabase.from("notifications").insert({
        recipient_type: "reviewer",
        recipient_id: reviewer.id,
        event_type: "new_submission",
        channel: "email",
        sent_at: null, // logged, not actually delivered — see docblock
      });
      if (notifError) throw new Error(`checkAndNotifyClosedEditWindows: failed to log notification: ${notifError.message}`);
    }

    const { error: updateError } = await supabase
      .from("reports")
      .update({ reviewer_notified_at: notifiedAt })
      .eq("id", r.id);
    if (updateError) throw new Error(`checkAndNotifyClosedEditWindows: failed to mark notified: ${updateError.message}`);
  }

  return reports.map((r) => ({ reportId: r.id as string, companyId: r.company_id as string }));
}
