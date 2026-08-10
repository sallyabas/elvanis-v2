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
 */
export type SubmissionDisplayStage = "editing" | "queued_for_audit" | "audit_in_progress";

export interface PendingSubmissionStatusInput {
  status: "editing" | "audit_in_progress" | "completed";
  edit_window_closes_at: string;
}

export function computeSubmissionDisplayStage(row: PendingSubmissionStatusInput, now: Date = new Date()): SubmissionDisplayStage | null {
  if (row.status === "completed") return null; // a real report exists now — not a "pending" stage anymore
  if (row.status === "audit_in_progress") return "audit_in_progress";
  const closesAt = new Date(row.edit_window_closes_at);
  return closesAt.getTime() <= now.getTime() ? "queued_for_audit" : "editing";
}

export const SUBMISSION_STAGE_LABELS: Record<SubmissionDisplayStage, string> = {
  editing: "Editing",
  queued_for_audit: "Queued for audit",
  audit_in_progress: "Audit in progress",
};
