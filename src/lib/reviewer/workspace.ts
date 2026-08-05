import { createAdminClient } from "@/lib/supabase/admin";
import type { LensFinding } from "@/lib/lenses/types";

/**
 * Reviewer workspace — the mandatory human validation gate (confirmed
 * 2026-08-01). A report can never reach `sent` without passing through
 * here (enforced at the DB level too, see reports_sent_requires_reviewer).
 * Every function here uses the service-role client — this is reviewer/
 * internal tooling, never exposed through client-scoped RLS.
 *
 * Three distinct per-finding outcomes, logged as three distinct
 * reviewer_status values (not two): accept -> "approved" (kept as-is),
 * edit -> "edited" (kept, but reviewer_edited_content is what the client
 * sees instead of ai_draft), reject -> "rejected" (dropped from the client
 * report, stays in the DB for the log). ai_draft is never mutated — it's
 * the immutable original AI output.
 */

export type FindingDisposition = "approved" | "edited" | "rejected";

export async function acceptFinding(findingId: string, reviewerNotes?: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lens_findings")
    .update({ reviewer_status: "approved", reviewer_notes: reviewerNotes ?? null })
    .eq("id", findingId);
  if (error) throw new Error(`acceptFinding failed: ${error.message}`);
}

export async function editFinding(findingId: string, editedContent: LensFinding, reviewerNotes?: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lens_findings")
    .update({
      reviewer_status: "edited",
      reviewer_edited_content: editedContent,
      reviewer_notes: reviewerNotes ?? null,
    })
    .eq("id", findingId);
  if (error) throw new Error(`editFinding failed: ${error.message}`);
}

export async function rejectFinding(findingId: string, reviewerNotes?: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("lens_findings")
    .update({ reviewer_status: "rejected", reviewer_notes: reviewerNotes ?? null })
    .eq("id", findingId);
  if (error) throw new Error(`rejectFinding failed: ${error.message}`);
}

/** For flagged cross-lens contradictions from Conflict Detection — pick one finding, or write a merged explanation. */
export async function resolveConflict(conflictId: string, reviewerNotes: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("finding_conflicts")
    .update({ resolution_status: "reviewer_resolved", reviewer_notes: reviewerNotes })
    .eq("id", conflictId);
  if (error) throw new Error(`resolveConflict failed: ${error.message}`);
}

export type DisputeResolution = "keep_ai_version" | "side_with_client" | "edit";

/**
 * For Commercial/Market ai_independent findings the client marked
 * not_confident. Reuses the same three underlying dispositions as regular
 * findings (keep_ai_version -> approved, side_with_client -> rejected,
 * edit -> edited) — a dispute isn't a fourth action type, it's the same
 * three actions applied to a disputed finding, plus mandatory reasoning.
 */
export async function resolveDispute(
  findingId: string,
  resolution: DisputeResolution,
  disputeResolutionNotes: string,
  editedContent?: LensFinding,
): Promise<void> {
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = { dispute_resolution_notes: disputeResolutionNotes };

  if (resolution === "keep_ai_version") {
    updates.reviewer_status = "approved";
  } else if (resolution === "side_with_client") {
    updates.reviewer_status = "rejected";
  } else {
    if (!editedContent) throw new Error("resolveDispute: editedContent is required when resolution is 'edit'");
    updates.reviewer_status = "edited";
    updates.reviewer_edited_content = editedContent;
  }

  const { error } = await supabase.from("lens_findings").update(updates).eq("id", findingId);
  if (error) throw new Error(`resolveDispute failed: ${error.message}`);
}

/** Re-ranks the top-3 independent of editing individual findings — just reorders which findings lead the report. */
export async function reRankTop3(reportId: string, orderedFindingIds: string[]): Promise<void> {
  if (orderedFindingIds.length === 0) throw new Error("reRankTop3: orderedFindingIds must not be empty");
  const supabase = createAdminClient();
  const { error } = await supabase.from("reports").update({ top_3_finding_ids: orderedFindingIds }).eq("id", reportId);
  if (error) throw new Error(`reRankTop3 failed: ${error.message}`);
}

export interface ApproveReportResult {
  approved: boolean;
  blockedReason?: string;
}

/**
 * Final action once everything else is settled: flips pending_review ->
 * approved. Blocked (not just discouraged) until every finding for this
 * report has a disposition and every conflict touching those findings is
 * resolved — "mandatory review" means the gate actually gates, not just a
 * UI convention (see spec §2.1). Does not send — see deliverReport.
 *
 * Real gap found and fixed 2026-08-03: the 24h client edit window was only
 * ever enforced as a Reviewer Queue listing filter (edit_window_closes_at
 * <= now), which hides early reports from the list but does not stop a
 * reviewer from approving one directly — nothing here checked the boundary
 * itself. A reviewer navigating straight to /review/[reportId] by URL
 * could approve during the client's own edit window, before review is
 * supposed to have started. Fixed by checking edit_window_closes_at as a
 * real gate here, not just a display/listing convenience.
 */
export async function approveReport(reportId: string, reviewerId: string): Promise<ApproveReportResult> {
  const supabase = createAdminClient();

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("edit_window_closes_at")
    .eq("id", reportId)
    .single();
  if (reportError) throw new Error(`approveReport: failed to load report: ${reportError.message}`);

  if (report.edit_window_closes_at && new Date(report.edit_window_closes_at).getTime() > Date.now()) {
    return {
      approved: false,
      blockedReason: `The client's 24h edit window hasn't closed yet (closes ${report.edit_window_closes_at}) — review can't start until then`,
    };
  }

  const { data: findings, error: findingsError } = await supabase
    .from("lens_findings")
    .select("id, reviewer_status")
    .eq("report_id", reportId);
  if (findingsError) throw new Error(`approveReport: failed to load findings: ${findingsError.message}`);

  const undecided = (findings ?? []).filter((f) => f.reviewer_status === "draft");
  if (undecided.length > 0) {
    return {
      approved: false,
      blockedReason: `${undecided.length} finding(s) still need a disposition (accept/edit/reject) before the report can be approved`,
    };
  }

  const findingIds = (findings ?? []).map((f) => f.id);
  if (findingIds.length > 0) {
    const { data: conflicts, error: conflictsError } = await supabase
      .from("finding_conflicts")
      .select("id, resolution_status")
      .or(`finding_a_id.in.(${findingIds.join(",")}),finding_b_id.in.(${findingIds.join(",")})`);
    if (conflictsError) throw new Error(`approveReport: failed to load conflicts: ${conflictsError.message}`);

    const unresolved = (conflicts ?? []).filter((c) => c.resolution_status === "unresolved");
    if (unresolved.length > 0) {
      return {
        approved: false,
        blockedReason: `${unresolved.length} conflict(s) still unresolved before the report can be approved`,
      };
    }
  }

  const { error: updateError } = await supabase
    .from("reports")
    .update({ status: "approved", reviewed_by: reviewerId, approved_at: new Date().toISOString() })
    .eq("id", reportId);
  if (updateError) throw new Error(`approveReport failed: ${updateError.message}`);

  return { approved: true };
}

/**
 * Moves an approved report to sent + records delivery. Logs a real
 * `report_ready` notification row for the client (recipient = the
 * company's owning user), but does NOT send the actual email itself here
 * — that's a separate, explicit step (`sendPendingNotifications()`,
 * confirmed 2026-08-04), same "log now, send on the next dispatch pass"
 * pattern already used by every other notification-creating function in
 * this codebase. Logging the row is safe and always correct; the actual
 * send is what genuinely needed explicit confirmation before firing.
 */
export async function deliverReport(reportId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: report, error: fetchError } = await supabase
    .from("reports")
    .select("status, company_id, companies(user_id)")
    .eq("id", reportId)
    .single();
  if (fetchError) throw new Error(`deliverReport: failed to load report: ${fetchError.message}`);
  if (report.status !== "approved") {
    throw new Error(`deliverReport: report must be approved first (current status: ${report.status})`);
  }

  const owner = report.companies as unknown as { user_id: string } | null;
  if (owner?.user_id) {
    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: owner.user_id,
      event_type: "report_ready",
      channel: "email",
      sent_at: null,
    });
    if (notifError) throw new Error(`deliverReport: failed to log notification: ${notifError.message}`);
  }

  const { error } = await supabase
    .from("reports")
    .update({ status: "sent", delivered_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) throw new Error(`deliverReport failed: ${error.message}`);
}
