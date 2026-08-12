import { createAdminClient } from "@/lib/supabase/admin";
import { getSettingNumber } from "@/lib/app-settings";
import { computeSubmissionDisplayStage, type SubmissionDisplayStage } from "./submission-status";
import type { EvidencePayload } from "@/lib/audit/run-pending-audits";

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
  /** First submitted (confirmed 2026-08-12, real bug list item #4) — anchored once, never reset by later edits. */
  submittedAt: string;
  /** Last touched (new column, confirmed 2026-08-12) — same value as submittedAt until a real in-window edit happens. */
  updatedAt: string;
}

/** The one active (non-'completed') pending submission for a company, if any — null if this company has none in flight right now. */
export async function loadActivePendingEvidenceSubmission(companyId: string): Promise<PendingEvidenceSubmissionRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pending_evidence_submissions")
    .select("id, company_id, goal_id, evidence_payload, status, edit_window_closes_at, submitted_at, updated_at")
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
    submittedAt: data.submitted_at as string,
    updatedAt: data.updated_at as string,
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
      updated_at: now.toISOString(),
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

  // stage === "editing": update in place, deadline untouched, updated_at
  // bumped to now (confirmed 2026-08-12, real bug list item #4) — the one
  // real signal that distinguishes "first submitted" from "last edited"
  // for the client-facing UI to show honestly.
  const { error } = await supabase
    .from("pending_evidence_submissions")
    .update({ goal_id: input.goalId, evidence_payload: input.evidencePayload, updated_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export interface ClaimedSubmissionForImmediateAudit {
  id: string;
  goalId: string;
  evidencePayload: EvidencePayload;
  submittedAt: string;
  editWindowClosesAt: string;
}

export type ClaimForImmediateAuditResult =
  | { claimed: true; row: ClaimedSubmissionForImmediateAudit }
  | { claimed: false; error: string };

/**
 * "Submit now, I'm done editing" fast-track (confirmed 2026-08-11, direct
 * founder request) — a deliberate, separate action from the normal wait-
 * for-the-window flow, not a variant of it. The single conditional UPDATE
 * below (status = 'editing' -> 'audit_in_progress', WHERE status is STILL
 * 'editing' at the moment this runs) is the entire correctness guarantee
 * against reopening the duplicate-Groq-call bug this whole architecture
 * exists to prevent: if a scheduled cron tick happens to claim the exact
 * same row in the same instant (its own edit_window_closes_at having just
 * passed naturally), only one of the two UPDATEs can actually match a row
 * still in 'editing' status — the other sees zero rows returned and backs
 * off cleanly (see run-pending-audits.ts's matching conditional claim,
 * the other real caller of this same guarantee). No separate lock table,
 * no advisory lock — Postgres's own row-level UPDATE atomicity is the
 * whole mechanism, same as everywhere else in this codebase that needs
 * "exactly one caller wins."
 *
 * edit_window_closes_at is deliberately set to NOW here, not left at its
 * originally-scheduled future value — the client explicitly chose to
 * close their own window early, so that's genuinely when it closed. This
 * mirrors the exact reasoning already applied to the cron path's own
 * "don't stack a second reviewer-visibility delay" fix: the resulting
 * report's window is already closed by construction, so it's immediately
 * reviewer-visible and the "N hours total" SLA copy stays honest, measured
 * from the real original submitted_at (left untouched here).
 */
export async function claimPendingEvidenceSubmissionForImmediateAudit(companyId: string): Promise<ClaimForImmediateAuditResult> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("pending_evidence_submissions")
    .update({ status: "audit_in_progress", edit_window_closes_at: now, last_attempted_at: now })
    .eq("company_id", companyId)
    .eq("status", "editing")
    .select("id, goal_id, evidence_payload, submitted_at, edit_window_closes_at")
    .maybeSingle();

  if (error) return { claimed: false, error: error.message };
  if (!data) {
    return {
      claimed: false,
      error: "Your evidence is no longer open for editing right now — it may already be queued or being analyzed.",
    };
  }
  if (!data.goal_id) {
    return { claimed: false, error: "Missing goal — can't run the audit." };
  }

  return {
    claimed: true,
    row: {
      id: data.id as string,
      goalId: data.goal_id as string,
      evidencePayload: data.evidence_payload as EvidencePayload,
      submittedAt: data.submitted_at as string,
      editWindowClosesAt: data.edit_window_closes_at as string,
    },
  };
}
