import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAudit } from "./run-audit";
import { loadCompanyProfileForLens, loadGoalContext } from "./load-profile";
import { notifyReviewersOfNewSubmission, notifyReviewersOfAwaitingPayment } from "@/lib/reviewer/notifications";
import type { EvidenceFieldInput } from "@/lib/lenses/types";
import type { CommercialSelfReport } from "@/lib/lenses/commercial";
import type { GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import type { MetricInput } from "@/lib/lenses/metrics";
import { runCompetitorResearchSafely } from "@/lib/lenses/commercial-research";

/**
 * The PRIMARY audit trigger (confirmed 2026-08-10, direct founder
 * architecture request) — closes the real bug at the heart of this whole
 * rebuild: runAudit() used to fire immediately and synchronously inside
 * submitEvidence(), on every submission including every resubmission
 * during the supposed 24h "edit window" — real Groq cost on every edit,
 * and a brand-new duplicate report every time, since nothing was ever
 * actually being "edited." Evidence submission now only stores/updates a
 * pending_evidence_submissions row (see pending-submission.ts); this
 * module is now called from TWO places (confirmed 2026-08-11, "Submit
 * now" fast-track): the cron tick (runPendingAudits, below) once
 * edit_window_closes_at has passed naturally, and evidence-intake's
 * submitEvidenceNow() action when a client explicitly chooses to skip the
 * wait. Both share the exact same race-safe claim discipline (see
 * runAuditForClaimedSubmission's own docblock) so a client's explicit
 * click and a cron tick that happens to land at the same moment can never
 * both run the audit. (rerunAudit() is unaffected — that's a separate,
 * reviewer-triggered, always-immediate path, unchanged by this work.)
 */

const STALE_RETRY_MINUTES = 10;

export interface EvidencePayload {
  financial: { evidenceFields: EvidenceFieldInput[]; metrics: MetricInput[] };
  execution: { evidenceFields: EvidenceFieldInput[]; metrics: MetricInput[] };
  product: { evidenceFields: EvidenceFieldInput[]; metrics: MetricInput[] };
  commercial: CommercialSelfReport;
  aiGovernance: {
    hasLiveAiInProduction: boolean;
    governanceDocsSubmitted: boolean;
    questionnaireScores?: Partial<Record<GovernanceDimensionKey, number>>;
    governanceEvidence?: EvidenceFieldInput[];
  };
}

export interface ClaimedPendingRow {
  id: string;
  company_id: string;
  goal_id: string | null;
  evidence_payload: EvidencePayload;
  submitted_at: string;
  edit_window_closes_at: string;
}

export interface RunPendingAuditsResult {
  processedReportIds: string[];
  /** Company IDs whose audit failed this tick and remain queued for retry on a later tick — not a permanent failure state, no dead-letter cap in this pass (see the migration's own docblock for why). */
  stillPending: string[];
  /**
   * Re-audit payment gate (confirmed 2026-09-06) — company IDs whose
   * re-audit is genuinely due (window closed) but deliberately WITHHELD
   * because payment_status is still 'pending'. Kept separate from
   * stillPending above (a real claim race or audit failure) since this is
   * a deliberate hold, not a failure — a reviewer must mark it paid
   * (see reaudit-payment.ts's markReaduitPaid()) before this function will
   * ever process it. Useful for direct verification of this exact flow.
   */
  awaitingPayment: string[];
}

/**
 * Runs the actual audit for a row that has ALREADY been atomically
 * claimed by the caller (status flipped away from 'editing' via a
 * conditional UPDATE that only one concurrent caller can win — see
 * runPendingAudits()'s claim step below and
 * claimPendingEvidenceSubmissionForImmediateAudit() in pending-
 * submission.ts for the two real callers). Never call this speculatively
 * against a row you haven't already claimed — that's exactly the
 * duplicate-Groq-call bug this whole architecture exists to prevent.
 * Exported (confirmed 2026-08-11) so the "Submit now" fast-track can
 * share this exact code path instead of a second, drifting copy.
 */
export async function runAuditForClaimedSubmission(supabase: SupabaseClient, row: ClaimedPendingRow): Promise<{ reportId: string } | { failed: true }> {
  // Real, confirmed bug fix (2026-08-29, honest onboarding test) —
  // self-healing pre-check, run BEFORE anything else, for both real
  // callers (the "Submit now" fast-track AND the cron's stale-retry).
  // Root cause: runAudit() itself could throw AFTER the report and its
  // findings were already fully persisted (originally: an unguarded
  // conflict-detection failure, now fixed in run-audit.ts itself) but
  // BEFORE this row got marked 'completed' below. Without this check,
  // the stale-retry safety net (runPendingAudits' own 10-minute re-pickup
  // of any still-'audit_in_progress' row) would blindly re-run the ENTIRE
  // 5-lens audit a second time against the same evidence — a genuine
  // duplicate report and a doubled real Groq bill for one submission,
  // the exact class of bug this whole delayed-execution architecture was
  // built to prevent, reintroduced through a different gap. Matched on
  // (company_id, submitted_at), never resulting_report_id — that's
  // precisely the field left null by the bug this guards against.
  // reports.submitted_at is always stamped from this exact row's own
  // submitted_at (see run-audit.ts's submittedAt override), never "now",
  // so the match is exact and reliable.
  const { data: existingReport, error: existingReportError } = await supabase
    .from("reports")
    .select("id, status, reviewer_notified_at")
    .eq("company_id", row.company_id)
    .eq("submitted_at", row.submitted_at)
    .maybeSingle();

  if (existingReportError) {
    console.error(
      `runAuditForClaimedSubmission: failed to check for an existing report for pending_evidence_submissions row ${row.id} (company ${row.company_id})`,
      existingReportError,
    );
    return { failed: true };
  }

  if (existingReport) {
    const reportId = existingReport.id as string;
    console.error(
      `runAuditForClaimedSubmission: found an existing report ${reportId} for pending_evidence_submissions row ${row.id} that was never marked completed — self-healing instead of re-running the audit`,
    );
    const { error: completeError } = await supabase
      .from("pending_evidence_submissions")
      .update({ status: "completed", resulting_report_id: reportId })
      .eq("id", row.id);
    if (completeError) {
      console.error(`runAuditForClaimedSubmission: found existing report ${reportId} but failed to mark row ${row.id} completed`, completeError);
      return { failed: true };
    }
    if (!existingReport.reviewer_notified_at) {
      try {
        await notifyReviewersOfNewSubmission(supabase, reportId);
      } catch (err) {
        // Not fatal — checkAndNotifyClosedEditWindows() already exists as
        // an idempotent backstop for exactly this ("reviewer_notified_at
        // still null on a pending_review report"), so this is a real,
        // logged miss but not one that permanently loses the notification.
        console.error(`runAuditForClaimedSubmission: found existing report ${reportId} but failed to notify reviewers`, err);
      }
    }
    return { reportId };
  }

  try {
    if (!row.goal_id) throw new Error("pending evidence submission has no goal_id");

    // Always the CURRENT profile, never a cached copy — same "living
    // record" principle as every other lens call in this codebase. The
    // whole point of delaying execution is that time passes between
    // submission and audit; the profile as of NOW is what should feed
    // the lenses, not the profile as of when evidence was first typed in.
    const company = await loadCompanyProfileForLens(supabase, row.company_id);
    const goal = await loadGoalContext(supabase, row.goal_id);
    const payload = row.evidence_payload;

    // Commercial auto-trigger (confirmed 2026-08-13, direct founder
    // request) — real gap closed: runCompetitorResearch() was fully built
    // and tested since 2026-07-31 but never had a caller in application
    // code; this hardcoded `independentResearch: []` on every real audit.
    // See runCompetitorResearchSafely()'s own docblock for why this is
    // defensive (a research failure must never fail the whole audit).
    const independentResearch = await runCompetitorResearchSafely({
      namedCompetitors: payload.commercial.namedCompetitors,
      industry: company.industry,
      businessModel: company.businessModel,
      customerType: company.customerType,
    });

    // rerun_of_report_id linking (confirmed 2026-09-06, direct founder
    // decision) — closes a real, confirmed gap: this client-initiated
    // path never linked a re-audit back to its predecessor at all, unlike
    // the reviewer's own separate QA rerunAudit() tool, which always has.
    // Links to the immediately-prior SENT report specifically (never the
    // very first one), so repeat re-audits form a real chain
    // (3rd → 2nd → 1st), not everything pointing at one root — the
    // "traceable progress over time" the founder asked this for. A
    // company's genuinely first-ever audit has no prior sent report, so
    // this is null for it, same as today.
    const { data: priorSentReport } = await supabase
      .from("reports")
      .select("id")
      .eq("company_id", row.company_id)
      .eq("status", "sent")
      .order("delivered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const result = await runAudit({
      companyId: row.company_id,
      company,
      goalId: row.goal_id,
      goal,
      financial: payload.financial,
      execution: payload.execution,
      product: payload.product,
      commercial: { selfReport: payload.commercial, independentResearch },
      aiGovernance: payload.aiGovernance,
      sourceEvidenceSnapshot: payload as unknown as Record<string, unknown>,
      rerunOfReportId: (priorSentReport?.id as string | undefined) ?? null,
      // Real bug found and fixed live (confirmed 2026-08-10) — without
      // this, runAudit() computes a fresh "now + edit_window_hours" for
      // the new report, stacking a second 24h reviewer-visibility delay
      // on top of the real edit window that already elapsed before this
      // function even ran. Passing the REAL original timestamps through
      // means the report is immediately reviewer-visible (its window is
      // already closed by construction) and the "72 hours total" SLA
      // copy stays honest, measured from when the client actually
      // submitted, not from whenever this actually ran. For the "Submit
      // now" caller specifically, edit_window_closes_at is the moment the
      // client chose to close it early (see claimPendingEvidenceSubmission
      // ForImmediateAudit) — genuinely when it closed, not the originally
      // scheduled future time.
      submittedAt: new Date(row.submitted_at),
      editWindowClosesAt: new Date(row.edit_window_closes_at),
    });

    const { error: completeError } = await supabase
      .from("pending_evidence_submissions")
      .update({ status: "completed", resulting_report_id: result.reportId })
      .eq("id", row.id);
    if (completeError) throw new Error(`failed to mark completed: ${completeError.message}`);

    // Notify reviewers NOW — the audit has actually finished and real
    // findings are persisted. This is the real trigger going forward, not
    // window-close (see notifications.ts's own updated docblock).
    await notifyReviewersOfNewSubmission(supabase, result.reportId);

    return { reportId: result.reportId };
  } catch (err) {
    // Real, confirmed bug fix (2026-08-29, honest onboarding test) — this
    // catch previously swallowed the exception with zero logging, making
    // a genuine failure diagnosable only by reading DB state directly
    // (confirmed live: reconstructing what happened here required a
    // direct DB query, not server logs, which showed nothing at all).
    // Logged now with enough context (which row/company, and the real
    // error) to actually diagnose a recurrence from server logs.
    console.error(
      `runAuditForClaimedSubmission: audit failed for pending_evidence_submissions row ${row.id} (company ${row.company_id}) — leaving status at 'audit_in_progress' for stale-retry`,
      err,
    );
    // Leave status at 'audit_in_progress' — a later tick re-picks this up
    // once last_attempted_at passes the stale threshold. Deliberately no
    // dead-letter table, no max-retry cap — a real, scoped simplification,
    // not an oversight; flagged in the migration's own docblock. The
    // self-healing pre-check above now means a re-pickup that finds a
    // report already exists (e.g. this exact exception happened AFTER
    // runAudit() itself already succeeded) links to it instead of
    // blindly re-running the whole audit a second time.
    return { failed: true };
  }
}

export async function runPendingAudits(): Promise<RunPendingAuditsResult> {
  const supabase = createAdminClient();
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_RETRY_MINUTES * 60 * 1000).toISOString();

  const { data: dueEditing, error: dueError } = await supabase
    .from("pending_evidence_submissions")
    .select("id, company_id, goal_id, evidence_payload, submitted_at, edit_window_closes_at, payment_status, payment_notified_at")
    .eq("status", "editing")
    .lte("edit_window_closes_at", now.toISOString());
  if (dueError) throw new Error(`runPendingAudits: failed to load due rows: ${dueError.message}`);

  // Re-audit payment gate (confirmed 2026-09-06) — a due row whose
  // payment_status is still 'pending' is deliberately NEVER claimed by
  // this function; the audit run is withheld until a reviewer marks it
  // paid (see reaudit-payment.ts's markReaduitPaid()). Notified exactly
  // once per row (payment_notified_at is the idempotency guard, same
  // pattern as reports.reviewer_notified_at) — without it, this same row
  // would re-notify the admin every single tick for as long as it sits
  // unpaid. Left at raw status='editing' the whole time;
  // computeSubmissionDisplayStage() already derives this as
  // "awaiting_payment" for the client/reviewer UI (see submission-status.ts).
  const awaitingPaymentRows = (dueEditing ?? []).filter((r) => r.payment_status === "pending");
  const claimableEditingRows = (dueEditing ?? []).filter((r) => r.payment_status !== "pending");

  for (const row of awaitingPaymentRows) {
    if (row.payment_notified_at) continue; // already notified once — nothing more to do here until a reviewer acts
    try {
      await notifyReviewersOfAwaitingPayment(supabase, row.id as string);
      const { error: notifiedError } = await supabase
        .from("pending_evidence_submissions")
        .update({ payment_notified_at: now.toISOString() })
        .eq("id", row.id);
      if (notifiedError) {
        console.error(`runPendingAudits: notified reviewers of awaiting-payment row ${row.id} but failed to stamp payment_notified_at`, notifiedError);
      }
    } catch (err) {
      console.error(`runPendingAudits: failed to notify reviewers of awaiting-payment row ${row.id}`, err);
    }
  }

  const { data: staleInProgress, error: staleError } = await supabase
    .from("pending_evidence_submissions")
    .select("id, company_id, goal_id, evidence_payload, submitted_at, edit_window_closes_at")
    .eq("status", "audit_in_progress")
    .or(`last_attempted_at.is.null,last_attempted_at.lte.${staleThreshold}`);
  if (staleError) throw new Error(`runPendingAudits: failed to load stale rows: ${staleError.message}`);

  // previousStatus tracked per row (confirmed 2026-08-11, "Submit now"
  // fast-track) — the claim step below must condition its UPDATE on
  // whatever status this row actually had when selected, not blindly
  // overwrite by id. Real gap this closes: a client's "Submit now" click
  // can flip a row from 'editing' to 'audit_in_progress' (and start
  // running its own audit) in the moment between this SELECT and the
  // claim UPDATE below — without a conditional claim, this cron tick
  // would blindly re-claim the same row and run runAuditForClaimedSubmission
  // a SECOND time against the same evidence, the exact duplicate-Groq-
  // call bug this whole architecture exists to prevent, just reintroduced
  // through a new second caller instead of the original resubmit bug.
  const rows = [
    ...claimableEditingRows.map((r) => ({ ...r, previousStatus: "editing" as const })),
    ...(staleInProgress ?? []).map((r) => ({ ...r, previousStatus: "audit_in_progress" as const })),
  ] as (ClaimedPendingRow & { previousStatus: "editing" | "audit_in_progress" })[];

  const processedReportIds: string[] = [];
  const stillPending: string[] = [];

  // Sequential, not parallel — runAudit() already internally staggers its
  // own 5 lens calls (see run-audit.ts); running MULTIPLE companies'
  // audits at the exact same time would multiply that burst-rate-limit
  // risk for no real benefit at current pilot volume. A scalability
  // concern to revisit once tick volume actually grows, not now.
  for (const row of rows) {
    const { data: claimedRows, error: markError } = await supabase
      .from("pending_evidence_submissions")
      .update({ status: "audit_in_progress", last_attempted_at: now.toISOString() })
      .eq("id", row.id)
      .eq("status", row.previousStatus)
      .select("id");
    if (markError || !claimedRows || claimedRows.length === 0) {
      // Either a real error, or (the case this fix exists for) another
      // process — most likely a client's "Submit now" click — already
      // claimed this exact row in the moment since the SELECT above.
      // Skip it entirely rather than proceed to process stale row data;
      // whichever caller actually won the claim is already running it.
      stillPending.push(row.company_id);
      continue;
    }

    const outcome = await runAuditForClaimedSubmission(supabase, row);
    if ("reportId" in outcome) {
      processedReportIds.push(outcome.reportId);
    } else {
      stillPending.push(row.company_id);
    }
  }

  return { processedReportIds, stillPending, awaitingPayment: awaitingPaymentRows.map((r) => r.company_id as string) };
}
