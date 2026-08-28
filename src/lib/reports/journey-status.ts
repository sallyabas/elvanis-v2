import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSubmissionDisplayStage, type SubmissionDisplayStage } from "@/lib/evidence/submission-status";

/**
 * Deterministic "what's the next step" signal (confirmed 2026-08-07) —
 * closes a real UX gap: Business Profile had no next-step CTA after saving
 * and no link into Evidence Intake, and the Dashboard's empty state didn't
 * distinguish "never submitted anything" from "evidence submitted, still
 * being reviewed." Both pages now read the same function instead of two
 * separately-reasoned-about queries that could drift — same "shared logic,
 * single source of truth" discipline already used for deriveRoadmap()/
 * getTotalTurnaroundHours().
 *
 * Extended 2026-08-10 for the delayed-execution architecture — a company
 * can now be "in progress" in a way that has no `reports` row at all yet
 * (editing / queued for audit / audit in progress all happen BEFORE
 * runAudit() ever creates one). This function checks for an active
 * (non-'completed') pending_evidence_submissions row FIRST; only once none
 * exists does it fall back to the original reports-based logic below,
 * unchanged from before this date.
 *
 * Extended again 2026-08-29 (real, confirmed bug fix, honest onboarding
 * test) — a pending_evidence_submissions row can be genuinely stuck at
 * 'audit_in_progress' even after a real report was already successfully
 * created for it (see runAuditForClaimedSubmission's own docblock for the
 * full root cause: runAudit() itself could throw AFTER persisting a real
 * report but before this row got marked 'completed'). Trusting the
 * pending-submission row's own status alone in that state would tell the
 * client "still analyzing" forever, even once a real, reviewable report
 * exists — confirmed live: a genuine 16-finding report sat delivered-
 * ready while Dashboard kept showing "being analyzed right now" with no
 * way for that message to ever self-correct. When status is specifically
 * 'audit_in_progress' (the only stage where a report could plausibly
 * already exist — 'editing'/'queued_for_audit' can't, by construction, a
 * report is only ever created once a row leaves 'editing'), this now
 * checks for a real report matched by (company_id, submitted_at) — the
 * same exact anchor runAuditForClaimedSubmission's own self-healing check
 * uses, never resulting_report_id, which is precisely the field left
 * null by the bug this guards against — and defers to the real report's
 * own status instead of the stale pending-submission status when found.
 *
 * Deliberately company-journey-only (the core audit's reports table +
 * pending_evidence_submissions), not module_requests/execution_sprints —
 * this answers "has this company ever gotten a core audit report," the
 * thing both consuming pages actually ask.
 *
 * MUST be called with the admin client, not the caller's session-scoped
 * one — `reports`' client-facing RLS policy only allows `status = 'sent'`
 * rows through (same real mismatch already documented and worked around on
 * the client Report view: see `src/app/(app)/reports/[reportId]/page.tsx`).
 * A session-scoped query here would silently see zero rows for any
 * `pending_review`/`approved` report and misreport a genuinely in-review
 * company as `no_evidence` — worse than not showing anything, since it
 * would prompt the client to re-submit evidence they already sent. Callers
 * must load+verify the company via the session client first (as every
 * consumer of this function already does) so the companyId passed in here
 * is never attacker-supplied.
 */
export type JourneyStage = "no_evidence" | "in_review" | "has_report" | SubmissionDisplayStage;

export interface JourneyStatus {
  stage: JourneyStage;
  latestReportId: string | null;
  /** Set only when stage is editing/queued_for_audit/audit_in_progress — the client's own edit-window deadline, for "X hours remaining" copy without a second query. */
  editWindowClosesAt: string | null;
}

export async function computeJourneyStatus(supabase: SupabaseClient, companyId: string): Promise<JourneyStatus> {
  const { data: pendingSubmission } = await supabase
    .from("pending_evidence_submissions")
    .select("status, edit_window_closes_at, submitted_at")
    .eq("company_id", companyId)
    .neq("status", "completed")
    .maybeSingle();

  if (pendingSubmission) {
    // Real, confirmed bug fix (2026-08-29) — see this function's own
    // docblock for the full root-cause writeup. Only checked for
    // 'audit_in_progress' specifically, since a report can't exist yet
    // for 'editing'/'queued_for_audit' by construction.
    if (pendingSubmission.status === "audit_in_progress") {
      const { data: reportForThisSubmission } = await supabase
        .from("reports")
        .select("id, status")
        .eq("company_id", companyId)
        .eq("submitted_at", pendingSubmission.submitted_at)
        .maybeSingle();

      if (reportForThisSubmission) {
        if (reportForThisSubmission.status === "sent") {
          return { stage: "has_report", latestReportId: reportForThisSubmission.id as string, editWindowClosesAt: null };
        }
        return { stage: "in_review", latestReportId: reportForThisSubmission.id as string, editWindowClosesAt: null };
      }
    }

    const stage = computeSubmissionDisplayStage({
      status: pendingSubmission.status as "editing" | "audit_in_progress" | "completed",
      edit_window_closes_at: pendingSubmission.edit_window_closes_at as string,
    });
    if (stage) {
      return { stage, latestReportId: null, editWindowClosesAt: pendingSubmission.edit_window_closes_at as string };
    }
  }

  const { data: latestReport } = await supabase
    .from("reports")
    .select("id, status")
    .eq("company_id", companyId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestReport) {
    return { stage: "no_evidence", latestReportId: null, editWindowClosesAt: null };
  }

  if (latestReport.status === "sent") {
    return { stage: "has_report", latestReportId: latestReport.id as string, editWindowClosesAt: null };
  }

  return { stage: "in_review", latestReportId: latestReport.id as string, editWindowClosesAt: null };
}
