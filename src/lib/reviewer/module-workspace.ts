import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Generic standalone-module review workspace (confirmed 2026-08-02) — the
 * same review MECHANISM as src/lib/reviewer/workspace.ts (Accept/Edit/
 * Reject/Approve, the same reviewer_status/report_status enums, the same
 * mandatory-gate and immutable-ai_draft rules), deliberately reused rather
 * than reimplemented, but operating on module_requests/module_findings
 * instead of reports/lens_findings — those carry core-audit-specific
 * fields (goalRelevance, financialImpact, conflicts, disputes) that don't
 * genuinely apply to a standalone module. Solved generically once here so
 * AI Reliability Audit, Tender Readiness, and Data Protection Compliance
 * all share this same implementation rather than three parallel ones.
 *
 * Deliberately omits resolveConflict/resolveDispute — those are cross-LENS
 * concepts (findings from different lenses contradicting each other, or a
 * client disputing an ai_independent Commercial finding) that don't apply
 * within a single standalone module's own findings.
 */

export async function acceptModuleFinding(findingId: string, reviewerNotes?: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("module_findings")
    .update({ reviewer_status: "approved", reviewer_notes: reviewerNotes ?? null })
    .eq("id", findingId);
  if (error) throw new Error(`acceptModuleFinding failed: ${error.message}`);
}

/**
 * Minimal shape guard (added 2026-08-05, real bug found live) — a
 * pre-existing module_findings row was discovered with
 * reviewer_edited_content set to a bare UUID string instead of an edited
 * finding object, causing "undefined" to render everywhere that trusted it
 * (the reviewer workspace UI and the new evidence-pack export both hit
 * this). Every module's findings share the same title/diagnosis/rootCause/
 * recommendedAction/severity structure (see LensFinding's own 4-field
 * discipline) regardless of which module they belong to, so this check is
 * safe to enforce generically here rather than per-module.
 */
function isValidEditedContentShape(v: Record<string, unknown>): boolean {
  return typeof v.title === "string" && typeof v.diagnosis === "string";
}

export async function editModuleFinding(findingId: string, editedContent: Record<string, unknown>, reviewerNotes?: string): Promise<void> {
  if (!isValidEditedContentShape(editedContent)) {
    throw new Error("editModuleFinding: editedContent is missing required fields (title/diagnosis) — refusing to persist malformed content.");
  }
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("module_findings")
    .update({
      reviewer_status: "edited",
      reviewer_edited_content: editedContent,
      reviewer_notes: reviewerNotes ?? null,
    })
    .eq("id", findingId);
  if (error) throw new Error(`editModuleFinding failed: ${error.message}`);
}

export async function rejectModuleFinding(findingId: string, reviewerNotes?: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("module_findings")
    .update({ reviewer_status: "rejected", reviewer_notes: reviewerNotes ?? null })
    .eq("id", findingId);
  if (error) throw new Error(`rejectModuleFinding failed: ${error.message}`);
}

export interface ApproveModuleRequestResult {
  approved: boolean;
  blockedReason?: string;
}

/** Same mandatory-gate logic as approveReport() — blocked, not just discouraged, until every finding has a disposition. */
export async function approveModuleRequest(requestId: string, reviewerId: string): Promise<ApproveModuleRequestResult> {
  const supabase = createAdminClient();

  const { data: findings, error: findingsError } = await supabase
    .from("module_findings")
    .select("id, reviewer_status")
    .eq("request_id", requestId);
  if (findingsError) throw new Error(`approveModuleRequest: failed to load findings: ${findingsError.message}`);

  const undecided = (findings ?? []).filter((f) => f.reviewer_status === "draft");
  if (undecided.length > 0) {
    return {
      approved: false,
      blockedReason: `${undecided.length} finding(s) still need a disposition (accept/edit/reject) before this request can be approved`,
    };
  }

  const { error: updateError } = await supabase
    .from("module_requests")
    .update({ status: "approved", reviewed_by: reviewerId, approved_at: new Date().toISOString() })
    .eq("id", requestId);
  if (updateError) throw new Error(`approveModuleRequest failed: ${updateError.message}`);

  return { approved: true };
}

/**
 * Procurement-answer dispositions (confirmed 2026-08-04, Priority 3) —
 * same Accept/Edit/Reject vocabulary and reviewer_status enum as findings,
 * on the separate `procurement_answers` table (Tender Readiness only).
 * Deliberately NOT part of approveModuleRequest()'s mandatory gate:
 * procurement answers are only generated from already-approved findings
 * (same reasoning as AI Opportunity Synthesis — never draft from findings
 * that might still change), so by the time they exist the gate they'd
 * belong to has already passed. Their own review value is enforced at
 * export time instead — only approved/edited answers appear in the
 * evidence pack, never draft or rejected ones.
 */
export async function acceptProcurementAnswer(answerId: string, reviewerNotes?: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("procurement_answers")
    .update({ reviewer_status: "approved", reviewer_notes: reviewerNotes ?? null })
    .eq("id", answerId);
  if (error) throw new Error(`acceptProcurementAnswer failed: ${error.message}`);
}

export async function editProcurementAnswer(answerId: string, editedAnswer: string, reviewerNotes?: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("procurement_answers")
    .update({ reviewer_status: "edited", reviewer_edited_answer: editedAnswer, reviewer_notes: reviewerNotes ?? null })
    .eq("id", answerId);
  if (error) throw new Error(`editProcurementAnswer failed: ${error.message}`);
}

export async function rejectProcurementAnswer(answerId: string, reviewerNotes?: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("procurement_answers")
    .update({ reviewer_status: "rejected", reviewer_notes: reviewerNotes ?? null })
    .eq("id", answerId);
  if (error) throw new Error(`rejectProcurementAnswer failed: ${error.message}`);
}

/**
 * Moves an approved request to sent + records delivery. Logs a real
 * `module_ready` notification row for the client (recipient = the
 * company's owning user) — closes a real gap found 2026-08-15 (module
 * intake/service flow review): this previously fired nothing at all,
 * unlike deliverReport()'s report_ready. Same "log now, send on the next
 * dispatch pass" pattern as every other notification-creating function in
 * this codebase — does NOT send the actual email itself here.
 */
export async function deliverModuleRequest(requestId: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: request, error: fetchError } = await supabase
    .from("module_requests")
    .select("status, company_id, companies(user_id)")
    .eq("id", requestId)
    .single();
  if (fetchError) throw new Error(`deliverModuleRequest: failed to load request: ${fetchError.message}`);
  if (request.status !== "approved") {
    throw new Error(`deliverModuleRequest: request must be approved first (current status: ${request.status})`);
  }

  const owner = request.companies as unknown as { user_id: string } | null;
  if (owner?.user_id) {
    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: owner.user_id,
      event_type: "module_ready",
      channel: "email",
      sent_at: null,
    });
    if (notifError) throw new Error(`deliverModuleRequest: failed to log notification: ${notifError.message}`);
  }

  const { error } = await supabase
    .from("module_requests")
    .update({ status: "sent", delivered_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw new Error(`deliverModuleRequest failed: ${error.message}`);
}
