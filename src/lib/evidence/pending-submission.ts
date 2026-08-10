import { createAdminClient } from "@/lib/supabase/admin";
import { getSettingNumber } from "@/lib/app-settings";
import { computeSubmissionDisplayStage, type SubmissionDisplayStage } from "./submission-status";

/**
 * Delayed-execution evidence storage (confirmed 2026-08-10, direct founder
 * architecture request) — replaces submitEvidence()'s previous behavior of
 * calling runAudit() immediately on every submission. Submitting now only
 * stores/updates a pending_evidence_submissions row; the audit itself runs
 * exactly once, later, via the new cron check (run-pending-audits.ts) once
 * edit_window_closes_at has passed. See the migration's own docblock for
 * the full "why."
 */

export interface PendingEvidenceSubmissionRecord {
  id: string;
  companyId: string;
  goalId: string | null;
  evidencePayload: Record<string, unknown>;
  stage: SubmissionDisplayStage;
  editWindowClosesAt: string;
}

/** The one active (non-'completed') pending submission for a company, if any — null if this company has none in flight right now. */
export async function loadActivePendingEvidenceSubmission(companyId: string): Promise<PendingEvidenceSubmissionRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pending_evidence_submissions")
    .select("id, company_id, goal_id, evidence_payload, status, edit_window_closes_at")
    .eq("company_id", companyId)
    .neq("status", "completed")
    .maybeSingle();
  if (error) throw new Error(`loadActivePendingEvidenceSubmission: ${error.message}`);
  if (!data) return null;

  const stage = computeSubmissionDisplayStage({
    status: data.status as "editing" | "audit_in_progress" | "completed",
    edit_window_closes_at: data.edit_window_closes_at as string,
  });
  if (!stage) return null; // defensive — neq('completed') should already exclude this

  return {
    id: data.id as string,
    companyId: data.company_id as string,
    goalId: data.goal_id as string | null,
    evidencePayload: data.evidence_payload as Record<string, unknown>,
    stage,
    editWindowClosesAt: data.edit_window_closes_at as string,
  };
}

export interface UpsertPendingEvidenceSubmissionInput {
  companyId: string;
  goalId: string;
  evidencePayload: Record<string, unknown>;
}

export interface UpsertPendingEvidenceSubmissionResult {
  success: boolean;
  error?: string;
}

/**
 * Insert-or-update-in-place. First submission: creates a new row and
 * anchors submitted_at/edit_window_closes_at (never reset by later edits —
 * see the migration docblock for why). A resubmission while status is
 * still 'editing' and the window hasn't closed: updates evidence_payload
 * in place, same row, same deadline — no new report, no Groq call. A
 * resubmission attempted after the window has closed or while the audit
 * is running: rejected with a clear reason rather than silently doing
 * something ambiguous (there's no coherent "edit" to make once the window
 * has closed — the evidence is already locked in for the run).
 */
export async function upsertPendingEvidenceSubmission(input: UpsertPendingEvidenceSubmissionInput): Promise<UpsertPendingEvidenceSubmissionResult> {
  const supabase = createAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("pending_evidence_submissions")
    .select("id, status, edit_window_closes_at")
    .eq("company_id", input.companyId)
    .neq("status", "completed")
    .maybeSingle();
  if (existingError) return { success: false, error: existingError.message };

  if (!existing) {
    const editWindowHours = await getSettingNumber("edit_window_hours", 24);
    const now = new Date();
    const closesAt = new Date(now.getTime() + editWindowHours * 60 * 60 * 1000);
    const { error } = await supabase.from("pending_evidence_submissions").insert({
      company_id: input.companyId,
      goal_id: input.goalId,
      evidence_payload: input.evidencePayload,
      status: "editing",
      submitted_at: now.toISOString(),
      edit_window_closes_at: closesAt.toISOString(),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  const stage = computeSubmissionDisplayStage({
    status: existing.status as "editing" | "audit_in_progress" | "completed",
    edit_window_closes_at: existing.edit_window_closes_at as string,
  });

  if (stage === "queued_for_audit") {
    return {
      success: false,
      error: "The window for changes has closed and your evidence is queued for analysis — you can't make further changes right now.",
    };
  }
  if (stage === "audit_in_progress") {
    return { success: false, error: "Your evidence is currently being analyzed — please wait for it to finish before making changes." };
  }

  // stage === "editing": update in place, deadline untouched.
  const { error } = await supabase
    .from("pending_evidence_submissions")
    .update({ goal_id: input.goalId, evidence_payload: input.evidencePayload })
    .eq("id", existing.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
