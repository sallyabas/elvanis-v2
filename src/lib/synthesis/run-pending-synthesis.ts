import { createAdminClient } from "@/lib/supabase/admin";
import { synthesizeAiOpportunities } from "./ai-opportunity";
import { persistAiOpportunitySynthesis } from "./persist-ai-opportunity";
import type { LensFindingWithSource } from "./conflict-detection";
import type { CompanyProfileForLens, EvidenceSufficiency, GoalContext, LensType, PrimaryGoal } from "@/lib/lenses/types";
import type { OverallMaturityTier } from "@/lib/lenses/ai-governance-framework";

/**
 * The actual auto-trigger for AI Opportunity Synthesis (confirmed
 * 2026-08-02) — approveReport() deliberately does NOT call this inline.
 * Coupling a Groq call to the interactive approve request would make
 * approval latency/reliability depend on Groq being up, and "regardless of
 * timing or who approves" means this must fire reliably no matter when
 * approval happened or which reviewer/session did it — a cron-picked-up
 * background pass, not something baked into one request, is what makes
 * that true. Idempotent via reports.ai_opportunity_synthesized_at, same
 * pattern as reviewer_notified_at.
 *
 * Real bug found and fixed 2026-08-12, direct founder request, found
 * while live-verifying the Dashboard rebuild that surfaces this data —
 * this query originally only matched `status = 'approved'`. A report that
 * reaches `approved` and then progresses to `sent` (deliverReport(), a
 * separate step) before this check ever ticks falls PERMANENTLY out of
 * that filter — nothing re-queues it, since `sent` was never a matched
 * status. In production this narrow window (approved → cron tick →
 * delivered) is normally closed by the ~20-minute GitHub Actions cadence,
 * but confirmed live that every real report created after 2026-08-04 in
 * this dev environment (where the cron never runs automatically at all)
 * had silently skipped synthesis entirely, permanently, the moment it was
 * delivered — the headline feature the Dashboard rebuild was built around
 * had been non-functional for every real report so far. Fixed by widening
 * the status match to `('approved', 'sent')` — synthesis's own inputs
 * (approved/edited findings, the report's own persisted
 * evidence_sufficiency_by_lens/governance_maturity_tier) are equally valid
 * whether the report is `approved` or already `sent`; nothing about
 * delivery invalidates them. Still fully idempotent via
 * `ai_opportunity_synthesized_at is null` — a `sent` report that already
 * got synthesized while it was briefly `approved` is correctly skipped.
 */

export interface PendingSynthesisResult {
  reportId: string;
  opportunityCount: number;
}

interface CompanyRow {
  name: string;
  industry: string | null;
  business_model: "B2B" | "B2C" | null;
  registration_country: string | null;
  customer_market_countries: string[] | null;
  employee_count: number | null;
  stage: string | null;
  revenue_range_band: string | null;
  customer_type: string | null;
  main_tools_stack: Record<string, unknown> | null;
  team_structure_summary: string | null;
}

function companyRowToProfile(row: CompanyRow): CompanyProfileForLens {
  return {
    name: row.name,
    industry: row.industry,
    businessModel: row.business_model,
    registrationCountry: row.registration_country,
    customerMarketCountries: row.customer_market_countries ?? [],
    employeeCount: row.employee_count,
    stage: row.stage,
    revenueRangeBand: row.revenue_range_band,
    customerType: row.customer_type,
    mainToolsStack: row.main_tools_stack,
    teamStructureSummary: row.team_structure_summary,
  };
}

interface GoalRow {
  primary_goal: string;
  secondary_goal: string | null;
  urgency_level: string | null;
  target_metric: string | null;
  time_horizon: string | null;
  success_definition: string | null;
  desired_future_state_primary: string | null;
  desired_future_state_secondary: string | null;
}

function goalRowToContext(row: GoalRow): GoalContext {
  return {
    primaryGoal: row.primary_goal as PrimaryGoal,
    secondaryGoal: row.secondary_goal as PrimaryGoal | null,
    urgencyLevel: row.urgency_level,
    targetMetric: row.target_metric,
    timeHorizon: row.time_horizon,
    successDefinition: row.success_definition,
    desiredFutureStatePrimary: row.desired_future_state_primary,
    desiredFutureStateSecondary: row.desired_future_state_secondary,
  };
}

export async function runPendingAiOpportunitySynthesis(): Promise<PendingSynthesisResult[]> {
  const supabase = createAdminClient();

  const { data: reports, error } = await supabase
    .from("reports")
    .select(
      "id, company_id, evidence_sufficiency_by_lens, governance_maturity_tier, companies(name, industry, business_model, registration_country, customer_market_countries, employee_count, stage, revenue_range_band, customer_type, main_tools_stack, team_structure_summary), goals(primary_goal, secondary_goal, urgency_level, target_metric, time_horizon, success_definition)",
    )
    .in("status", ["approved", "sent"])
    .is("ai_opportunity_synthesized_at", null);

  if (error) throw new Error(`runPendingAiOpportunitySynthesis: failed to load reports: ${error.message}`);
  if (!reports || reports.length === 0) return [];

  const results: PendingSynthesisResult[] = [];

  for (const report of reports) {
    const company = report.companies as unknown as CompanyRow | null;
    const goal = report.goals as unknown as GoalRow | null;
    if (!company || !goal) {
      throw new Error(`runPendingAiOpportunitySynthesis: report ${report.id} is missing company or goal data`);
    }

    const { data: findings, error: findingsError } = await supabase
      .from("lens_findings")
      .select("id, lens, ai_draft, reviewer_edited_content")
      .eq("report_id", report.id)
      .in("reviewer_status", ["approved", "edited"]);
    if (findingsError) throw new Error(`runPendingAiOpportunitySynthesis: failed to load findings for ${report.id}: ${findingsError.message}`);

    const approvedFindings: LensFindingWithSource[] = (findings ?? []).map((f) => ({
      lens: f.lens as LensType,
      finding: { ...(f.reviewer_edited_content ?? f.ai_draft), findingId: f.id as string },
    }));

    const result = await synthesizeAiOpportunities(
      approvedFindings,
      (report.evidence_sufficiency_by_lens as Partial<Record<LensType, EvidenceSufficiency>>) ?? {},
      report.governance_maturity_tier as OverallMaturityTier | null,
      companyRowToProfile(company),
      goalRowToContext(goal),
    );

    await persistAiOpportunitySynthesis(report.id as string, report.company_id as string, result);
    results.push({ reportId: report.id as string, opportunityCount: result.opportunities.length });
  }

  return results;
}
