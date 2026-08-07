import { createAdminClient } from "@/lib/supabase/admin";
import { runAudit, type RunAuditResult } from "./run-audit";
import type { CompanyProfileForLens, GoalContext, EvidenceFieldInput } from "@/lib/lenses/types";
import type { GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import type { CommercialSelfReport } from "@/lib/lenses/commercial";
import type { MetricInput } from "@/lib/lenses/metrics";

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
  // other lens call in this codebase.
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(
      "id, name, industry, business_model, registration_country, customer_market_countries, employee_count, stage, revenue_range_band, customer_type, main_tools_stack, team_structure_summary",
    )
    .eq("id", report.company_id)
    .single();
  if (companyError || !company) throw new Error(`rerunAudit: company not found: ${companyError?.message}`);

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("primary_goal, secondary_goal, urgency_level, target_metric, time_horizon, success_definition, desired_future_state_primary, desired_future_state_secondary")
    .eq("id", report.goal_id)
    .single();
  if (goalError || !goal) throw new Error(`rerunAudit: goal not found: ${goalError?.message}`);

  const companyProfile: CompanyProfileForLens = {
    name: company.name as string,
    industry: company.industry as string | null,
    businessModel: company.business_model as "B2B" | "B2C" | null,
    registrationCountry: company.registration_country as string | null,
    customerMarketCountries: (company.customer_market_countries as string[]) ?? [],
    employeeCount: company.employee_count as number | null,
    stage: company.stage as string | null,
    revenueRangeBand: company.revenue_range_band as string | null,
    customerType: company.customer_type as string | null,
    mainToolsStack: company.main_tools_stack as Record<string, unknown> | null,
    teamStructureSummary: company.team_structure_summary as string | null,
  };

  const goalContext: GoalContext = {
    primaryGoal: goal.primary_goal,
    secondaryGoal: goal.secondary_goal,
    urgencyLevel: goal.urgency_level,
    targetMetric: goal.target_metric,
    timeHorizon: goal.time_horizon,
    successDefinition: goal.success_definition,
    desiredFutureStatePrimary: goal.desired_future_state_primary,
    desiredFutureStateSecondary: goal.desired_future_state_secondary,
  };

  const result = await runAudit({
    companyId: report.company_id as string,
    company: companyProfile,
    goalId: report.goal_id as string,
    goal: goalContext,
    financial: { evidenceFields: snapshot.financial.evidenceFields, metrics: snapshot.financial.metrics ?? NO_METRICS },
    execution: { evidenceFields: snapshot.execution.evidenceFields, metrics: snapshot.execution.metrics ?? NO_METRICS },
    product: { evidenceFields: snapshot.product.evidenceFields, metrics: snapshot.product.metrics ?? NO_METRICS },
    commercial: { selfReport: snapshot.commercial, independentResearch: [] },
    aiGovernance: snapshot.aiGovernance,
    sourceEvidenceSnapshot: snapshot as unknown as Record<string, unknown>,
    rerunOfReportId: reportId,
  });

  return { ...result, rerunOfReportId: reportId };
}
