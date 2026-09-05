/**
 * Delayed-execution submission status (confirmed 2026-08-10) — the real
 * lifecycle a piece of evidence goes through before a report exists:
 *
 *   Editing → Queued for audit → Audit in progress → (report exists)
 *
 * "Queued for audit" is deliberately NOT a persisted status value —
 * pending_evidence_submissions.status only ever stores 'editing',
 * 'audit_in_progress', or 'completed' (see the migration's own docblock).
 * It's derived here instead: status is still 'editing' in the DB, but
 * edit_window_closes_at has already passed. Deriving it means the
 * client/reviewer UI is accurate the instant the window closes, not only
 * after the next cron tick (up to ~20 minutes later on the GitHub Actions
 * cadence) gets around to writing a new value.
 *
 * "Awaiting payment" added 2026-09-06 (re-audit payment gate, direct
 * founder decision) — the SAME derivation treatment as "queued_for_audit"
 * above, not a new raw status value: a re-audit whose window has closed
 * but whose payment_status is still 'pending' takes this branch INSTEAD
 * of "queued_for_audit," since the audit run is deliberately withheld
 * until a reviewer marks it paid (see run-pending-audits.ts). A row
 * genuinely awaiting payment stays at raw status='editing' in the DB the
 * whole time — it only ever advances to 'audit_in_progress' once payment
 * clears.
 */
export type SubmissionDisplayStage = "editing" | "queued_for_audit" | "audit_in_progress" | "awaiting_payment";

export interface PendingSubmissionStatusInput {
  status: "editing" | "audit_in_progress" | "completed";
  edit_window_closes_at: string;
  /** Optional — omitting it (e.g. a caller that never needed to know) behaves exactly as before this field existed, never derives "awaiting_payment". */
  payment_status?: "not_required" | "pending" | "paid";
}

export function computeSubmissionDisplayStage(row: PendingSubmissionStatusInput, now: Date = new Date()): SubmissionDisplayStage | null {
  if (row.status === "completed") return null; // a real report exists now — not a "pending" stage anymore
  if (row.status === "audit_in_progress") return "audit_in_progress";
  const closesAt = new Date(row.edit_window_closes_at);
  if (closesAt.getTime() > now.getTime()) return "editing";
  return row.payment_status === "pending" ? "awaiting_payment" : "queued_for_audit";
}

export const SUBMISSION_STAGE_LABELS: Record<SubmissionDisplayStage, string> = {
  editing: "Editing",
  queued_for_audit: "Queued for audit",
  audit_in_progress: "Audit in progress",
  awaiting_payment: "Awaiting payment",
};
