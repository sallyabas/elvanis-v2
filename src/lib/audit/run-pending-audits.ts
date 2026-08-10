import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAudit } from "./run-audit";
import { loadCompanyProfileForLens, loadGoalContext } from "./load-profile";
import { notifyReviewersOfNewSubmission } from "@/lib/reviewer/notifications";
import type { EvidenceFieldInput } from "@/lib/lenses/types";
import type { CommercialSelfReport } from "@/lib/lenses/commercial";
import type { GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import type { MetricInput } from "@/lib/lenses/metrics";

/**
 * The new PRIMARY audit trigger (confirmed 2026-08-10, direct founder
 * architecture request) — closes the real bug at the heart of this whole
 * rebuild: runAudit() used to fire immediately and synchronously inside
 * submitEvidence(), on every submission including every resubmission
 * during the supposed 24h "edit window" — real Groq cost on every edit,
 * and a brand-new duplicate report every time, since nothing was ever
 * actually being "edited." Evidence submission now only stores/updates a
 * pending_evidence_submissions row (see pending-submission.ts); THIS
 * function, called from the cron tick, is the only place runAudit() gets
 * triggered by a client submission from here on — exactly once, only
 * after edit_window_closes_at has passed, using whatever evidence is on
 * record at that moment. (rerunAudit() is unaffected — that's a separate,
 * reviewer-triggered, always-immediate path, unchanged by this work.)
 */

const STALE_RETRY_MINUTES = 10;

interface EvidencePayload {
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

interface PendingRow {
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
}

async function processRow(supabase: SupabaseClient, row: PendingRow): Promise<{ reportId: string } | { failed: true }> {
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

    const result = await runAudit({
      companyId: row.company_id,
      company,
      goalId: row.goal_id,
      goal,
      financial: payload.financial,
      execution: payload.execution,
      product: payload.product,
      commercial: { selfReport: payload.commercial, independentResearch: [] },
      aiGovernance: payload.aiGovernance,
      sourceEvidenceSnapshot: payload as unknown as Record<string, unknown>,
      // Real bug found and fixed live (confirmed 2026-08-10) — without
      // this, runAudit() computes a fresh "now + edit_window_hours" for
      // the new report, stacking a second 24h reviewer-visibility delay
      // on top of the real edit window that already elapsed before this
      // function even ran. Passing the REAL original timestamps through
      // means the report is immediately reviewer-visible (its window is
      // already closed by construction) and the "72 hours total" SLA
      // copy stays honest, measured from when the client actually
      // submitted, not from whenever the cron happened to process it.
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
  } catch {
    // Leave status at 'audit_in_progress' — a later tick re-picks this up
    // once last_attempted_at passes the stale threshold. Deliberately no
    // error detail persisted/surfaced beyond that for now (no dead-letter
    // table, no max-retry cap) — a real, scoped simplification, not an
    // oversight; flagged in the migration's own docblock.
    return { failed: true };
  }
}

export async function runPendingAudits(): Promise<RunPendingAuditsResult> {
  const supabase = createAdminClient();
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_RETRY_MINUTES * 60 * 1000).toISOString();

  const { data: dueEditing, error: dueError } = await supabase
    .from("pending_evidence_submissions")
    .select("id, company_id, goal_id, evidence_payload, submitted_at, edit_window_closes_at")
    .eq("status", "editing")
    .lte("edit_window_closes_at", now.toISOString());
  if (dueError) throw new Error(`runPendingAudits: failed to load due rows: ${dueError.message}`);

  const { data: staleInProgress, error: staleError } = await supabase
    .from("pending_evidence_submissions")
    .select("id, company_id, goal_id, evidence_payload, submitted_at, edit_window_closes_at")
    .eq("status", "audit_in_progress")
    .or(`last_attempted_at.is.null,last_attempted_at.lte.${staleThreshold}`);
  if (staleError) throw new Error(`runPendingAudits: failed to load stale rows: ${staleError.message}`);

  const rows = [...(dueEditing ?? []), ...(staleInProgress ?? [])] as PendingRow[];

  const processedReportIds: string[] = [];
  const stillPending: string[] = [];

  // Sequential, not parallel — runAudit() already internally staggers its
  // own 5 lens calls (see run-audit.ts); running MULTIPLE companies'
  // audits at the exact same time would multiply that burst-rate-limit
  // risk for no real benefit at current pilot volume. A scalability
  // concern to revisit once tick volume actually grows, not now.
  for (const row of rows) {
    const { error: markError } = await supabase
      .from("pending_evidence_submissions")
      .update({ status: "audit_in_progress", last_attempted_at: now.toISOString() })
      .eq("id", row.id);
    if (markError) {
      stillPending.push(row.company_id);
      continue;
    }

    const outcome = await processRow(supabase, row);
    if ("reportId" in outcome) {
      processedReportIds.push(outcome.reportId);
    } else {
      stillPending.push(row.company_id);
    }
  }

  return { processedReportIds, stillPending };
}
