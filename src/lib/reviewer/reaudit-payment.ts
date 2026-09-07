import { createAdminClient } from "@/lib/supabase/admin";
import { runAuditForClaimedSubmission, type EvidencePayload } from "@/lib/audit/run-pending-audits";

export interface MarkReaduitPaidResult {
  success: boolean;
  error?: string;
  reportId?: string;
}

/**
 * The reviewer's own "Mark as paid" action (confirmed 2026-09-06, re-audit
 * payment gate) — the third real caller of runAuditForClaimedSubmission(),
 * alongside the cron tick (run-pending-audits.ts's runPendingAudits()) and
 * the client's own "Submit now" fast-track
 * (claimPendingEvidenceSubmissionForImmediateAudit()).
 *
 * Deliberately NOT the same UI/mechanism as PaymentStatusRow/
 * ServiceStatusRow (confirmed with the founder before building) — those
 * are keyed to an ALREADY-EXISTING reports/module_request/etc. row, and at
 * the moment this fires, no `reports` row exists yet for this cycle
 * (that's the entire point of the gate — the audit hasn't run). Once the
 * audit DOES run below and a real report is created, the existing
 * PaymentStatusRow/ServiceStatusRow mechanism on /company/[companyId]
 * takes over for post-audit tracking exactly as it already does today
 * (and will now correctly apply, since Part 1 of this same feature links
 * rerun_of_report_id on this path) — this function only closes the
 * PRE-audit gate, it doesn't replace or duplicate that later tracking.
 *
 * The single conditional UPDATE below — payment_status: 'pending' ->
 * 'paid' AND status: 'editing' -> 'audit_in_progress', in the SAME
 * statement, WHERE both conditions still hold — is the entire correctness
 * guarantee against a race with a concurrent cron tick, same "one atomic
 * UPDATE is the whole mechanism" discipline already used by the other two
 * callers. A cron tick reading this row a moment earlier (still
 * payment_status = 'pending') correctly refuses to claim it (see
 * runPendingAudits()'s own matching guard); only this action can ever
 * move payment_status off 'pending', so there is no window where both
 * could win.
 */
export async function markReaduitPaid(pendingSubmissionId: string): Promise<MarkReaduitPaidResult> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Widened 2026-09-07 (unified flow spec) to also accept 'unpaid' — a
  // reviewer who earlier confirmed non-payment can come back and mark
  // the same submission paid once it actually arrives, same claim
  // mechanism either way.
  const { data, error } = await supabase
    .from("pending_evidence_submissions")
    .update({ payment_status: "paid", status: "audit_in_progress", last_attempted_at: now })
    .eq("id", pendingSubmissionId)
    .eq("status", "editing")
    .in("payment_status", ["pending", "unpaid"])
    .select("id, company_id, goal_id, evidence_payload, submitted_at, edit_window_closes_at")
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) {
    return { success: false, error: "This submission is no longer awaiting payment — it may have already been processed." };
  }
  if (!data.goal_id) {
    return { success: false, error: "Missing goal — can't run the audit." };
  }

  const outcome = await runAuditForClaimedSubmission(supabase, {
    id: data.id as string,
    company_id: data.company_id as string,
    goal_id: data.goal_id as string,
    evidence_payload: data.evidence_payload as EvidencePayload,
    submitted_at: data.submitted_at as string,
    edit_window_closes_at: data.edit_window_closes_at as string,
  });

  // Real, deliberate design note: on failure here, payment_status is
  // ALREADY 'paid' (this function's own UPDATE above already committed
  // it) and status is left at 'audit_in_progress' by
  // runAuditForClaimedSubmission()'s own catch block — the cron's
  // existing stale-retry pickup (status = 'audit_in_progress' past the
  // staleness threshold) picks this up on its own next tick with no
  // special-casing needed, since payment is no longer the blocker by
  // then.
  if ("reportId" in outcome) {
    return { success: true, reportId: outcome.reportId };
  }
  return {
    success: false,
    error: "Marked as paid, but something went wrong starting the analysis. It's been queued for an automatic retry shortly — no need to try again.",
  };
}

export interface ReaduitPaymentActionResult {
  success: boolean;
  error?: string;
}

/** Loads the company's owning user id for a re-audit submission — the real recipient for every client-facing notification this file fires. */
async function loadPendingSubmissionOwner(supabase: ReturnType<typeof createAdminClient>, pendingSubmissionId: string): Promise<string | null> {
  const { data } = await supabase.from("pending_evidence_submissions").select("companies(user_id)").eq("id", pendingSubmissionId).maybeSingle();
  const owner = data?.companies as unknown as { user_id: string } | null;
  return owner?.user_id ?? null;
}

/**
 * The reviewer's "Mark as unpaid" action (confirmed 2026-09-07, unified
 * flow spec — mirrors markModuleUnpaid()). No separate 'processing' claim
 * field exists here the way it does for modules — `status` itself is the
 * real atomic lock for re-audits (markReaduitPaid() moves it straight
 * from 'editing' to 'audit_in_progress'), so once a paid claim succeeds,
 * `status` is no longer 'editing' and this WHERE clause naturally can't
 * match — no extra race window to close.
 */
export async function markReaduitUnpaid(pendingSubmissionId: string): Promise<ReaduitPaymentActionResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pending_evidence_submissions")
    .update({ payment_status: "unpaid" })
    .eq("id", pendingSubmissionId)
    .eq("status", "editing")
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "This submission is no longer awaiting payment, or is already being processed." };

  const recipientId = await loadPendingSubmissionOwner(supabase, pendingSubmissionId);
  if (recipientId) {
    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: recipientId,
      event_type: "reaudit_unpaid",
      channel: "email",
      related_pending_submission_id: pendingSubmissionId,
      sent_at: null,
    });
    if (notifError) throw new Error(`markReaduitUnpaid: failed to log notification: ${notifError.message}`);
  }

  return { success: true };
}

/**
 * The reviewer's "Cancel" action (confirmed 2026-09-07, unified flow
 * spec) — the real case where a reviewer has followed up about unpaid
 * status and either side decides to give up. Only reachable from
 * 'editing'/pending-or-unpaid (a submission whose audit is already
 * running or done goes through the normal review pipeline instead).
 * Setting status to 'canceled' correctly frees this company's one-active-
 * submission slot (see the partial unique index rebuild in
 * 20260907092500) — a canceled re-audit doesn't block a genuinely new one.
 */
export async function cancelReaudit(pendingSubmissionId: string, reason: string): Promise<ReaduitPaymentActionResult> {
  if (!reason.trim()) return { success: false, error: "A cancellation reason is required." };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pending_evidence_submissions")
    .update({ status: "canceled", cancellation_reason: reason.trim() })
    .eq("id", pendingSubmissionId)
    .eq("status", "editing")
    .in("payment_status", ["pending", "unpaid"])
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "This submission is no longer awaiting payment — it may already be past cancellation." };

  const recipientId = await loadPendingSubmissionOwner(supabase, pendingSubmissionId);
  if (recipientId) {
    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: recipientId,
      event_type: "reaudit_canceled",
      channel: "email",
      related_pending_submission_id: pendingSubmissionId,
      sent_at: null,
    });
    if (notifError) throw new Error(`cancelReaudit: failed to log notification: ${notifError.message}`);
  }

  return { success: true };
}
