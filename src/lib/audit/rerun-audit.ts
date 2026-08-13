import { createAdminClient } from "@/lib/supabase/admin";
import { runAudit, type RunAuditResult } from "./run-audit";
import { loadCompanyProfileForLens, loadGoalContext } from "./load-profile";
import type { EvidenceFieldInput } from "@/lib/lenses/types";
import type { GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import type { CommercialSelfReport } from "@/lib/lenses/commercial";
import type { MetricInput } from "@/lib/lenses/metrics";
import { runCompetitorResearchSafely } from "@/lib/lenses/commercial-research";

/**
 * Basic re-run/refresh button (confirmed 2026-08-05, pulled forward from
 * V2 — "doesn't need real case history at all; only a future retrieval-
 * informed upgrade does"). Re-executes the five lenses fresh against the
 * SAME evidence a report was originally built from (see
 * `reports.source_evidence_snapshot`), but the CURRENT company/goal
 * profile — never a cached copy, same "business profile is a living
 * record" principle already established for every lens prompt. Produces a
 * brand-new report in `pending_review`; the mandatory review gate applies
 * exactly as it does to any other report, no shortcut.
 *
 * Deliberately reviewer-triggered, not a client self-serve button — spec's
 * own §1.5 free-tier rule ("Free tier = first completed audit per company
 * only. Re-audits are always paid") has no enforcement mechanism yet (no
 * payment provider is integrated anywhere in this codebase), so an
 * unrestricted client-facing button would silently create free unlimited
 * re-runs. A reviewer-triggered version has no such collision and is still
 * genuinely useful on its own (refreshing findings after a prompt/schema
 * fix, QA, or a reviewer's own judgment call) — a client self-serve version
 * is real, deliberately deferred follow-on scope once billing exists, not
 * silently dropped.
 */

const NO_METRICS: MetricInput[] = [];

interface EvidenceForLensSnapshot {
  evidenceFields: EvidenceFieldInput[];
  /**
   * Optional (added 2026-08-07, real numeric metrics landing in Evidence
   * Intake) — a snapshot from before this date won't have it, so `?? NO_METRICS`
   * below is a real fallback, not defensive boilerplate.
   */
  metrics?: MetricInput[];
}

interface SourceEvidenceSnapshot {
  financial: EvidenceForLensSnapshot;
  execution: EvidenceForLensSnapshot;
  product: EvidenceForLensSnapshot;
  commercial: CommercialSelfReport;
  aiGovernance: {
    hasLiveAiInProduction: boolean;
    governanceDocsSubmitted: boolean;
    questionnaireScores?: Partial<Record<GovernanceDimensionKey, number>>;
    governanceEvidence?: EvidenceFieldInput[];
  };
}

export interface RerunAuditResult extends RunAuditResult {
  rerunOfReportId: string;
}

export async function rerunAudit(reportId: string): Promise<RerunAuditResult> {
  const supabase = createAdminClient();

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, company_id, goal_id, source_evidence_snapshot")
    .eq("id", reportId)
    .single();
  if (reportError || !report) throw new Error(`rerunAudit: report not found: ${reportError?.message}`);

  const snapshot = report.source_evidence_snapshot as SourceEvidenceSnapshot | null;
  if (!snapshot) {
    throw new Error(
      "This report predates evidence-snapshot support and cannot be re-run — no stored evidence to re-run against. Ask the client to submit a new audit instead.",
    );
  }

  // Always re-read the CURRENT company/goal profile, never the state at
  // original submission time — same "living record" principle as every
  // other lens call in this codebase. Shared loader (confirmed 2026-08-10,
  // delayed-execution architecture) — see load-profile.ts docblock; this
  // exact block used to be duplicated here and in submitEvidence(), and
  // was about to become a third copy in run-pending-audits.ts.
  if (!report.goal_id) throw new Error("rerunAudit: report has no goal_id");
  const companyProfile = await loadCompanyProfileForLens(supabase, report.company_id as string);
  const goalContext = await loadGoalContext(supabase, report.goal_id as string);

  // Commercial auto-trigger (confirmed 2026-08-13) — re-run fresh, not
  // read from the original snapshot: independent research is real-time
  // web search, not evidence the client submitted, so a rerun should
  // reflect current market conditions, same "living record, never cached"
  // principle already applied to the company/goal profile just above.
  const independentResearch = await runCompetitorResearchSafely({
    namedCompetitors: snapshot.commercial.namedCompetitors,
    industry: companyProfile.industry,
    businessModel: companyProfile.businessModel,
    customerType: companyProfile.customerType,
  });

  const result = await runAudit({
    companyId: report.company_id as string,
    company: companyProfile,
    goalId: report.goal_id as string,
    goal: goalContext,
    financial: { evidenceFields: snapshot.financial.evidenceFields, metrics: snapshot.financial.metrics ?? NO_METRICS },
    execution: { evidenceFields: snapshot.execution.evidenceFields, metrics: snapshot.execution.metrics ?? NO_METRICS },
    product: { evidenceFields: snapshot.product.evidenceFields, metrics: snapshot.product.metrics ?? NO_METRICS },
    commercial: { selfReport: snapshot.commercial, independentResearch },
    aiGovernance: snapshot.aiGovernance,
    sourceEvidenceSnapshot: snapshot as unknown as Record<string, unknown>,
    rerunOfReportId: reportId,
  });

  return { ...result, rerunOfReportId: reportId };
}
