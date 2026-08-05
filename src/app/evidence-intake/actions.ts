"use server";

import { createClient } from "@/lib/supabase/server";
import { runAudit } from "@/lib/audit/run-audit";
import type { CompanyProfileForLens, EvidenceFieldInput, GoalContext } from "@/lib/lenses/types";
import type { GovernanceDimensionKey } from "@/lib/lenses/ai-governance-framework";
import type { CommercialSelfReport } from "@/lib/lenses/commercial";
import type { MetricInput } from "@/lib/lenses/metrics";

export interface SubmitEvidenceInput {
  companyId: string;
  goalId: string;
  privacyAcknowledged: boolean;
  financial: { evidenceFields: EvidenceFieldInput[] };
  execution: { evidenceFields: EvidenceFieldInput[] };
  product: { evidenceFields: EvidenceFieldInput[] };
  commercial: CommercialSelfReport;
  aiGovernance: {
    hasLiveAiInProduction: boolean;
    governanceDocsSubmitted: boolean;
    questionnaireScores?: Partial<Record<GovernanceDimensionKey, number>>;
    governanceEvidence?: EvidenceFieldInput[];
  };
}

export interface SubmitEvidenceResult {
  success: boolean;
  reportId?: string;
  error?: string;
}

const NO_METRICS: MetricInput[] = [];

/**
 * Real evidence submission (confirmed 2026-08-03, Priority 1) — fill-in-
 * template path first, native CSV/PDF upload/parsing explicitly deferred
 * (see CLAUDE.md "Evidence Intake scope decision" and spec §5). Numeric
 * `metrics` (benchmark-comparable values) are also deferred for this
 * pass — the fill-in form collects free-text `evidenceFields` only;
 * lenses already handle metric-less evidence correctly (extensively
 * tested earlier this build), this just means benchmark comparisons won't
 * fire for a minimal-pass submission, not that anything is broken.
 * `independentResearch` for Commercial is also deferred — the real Tavily
 * research automation already exists (commercial-research.ts) but wiring
 * an automatic trigger into this client-facing submission flow is a
 * separate decision, not assumed here.
 *
 * Uses the session's own RLS-respecting client to verify ownership before
 * ever touching runAudit() — never trusts a client-supplied companyId
 * blindly, same discipline as every reviewer Server Action in this
 * codebase re-checking session+role before acting.
 */
export async function submitEvidence(input: SubmitEvidenceInput): Promise<SubmitEvidenceResult> {
  if (!input.privacyAcknowledged) {
    return { success: false, error: "You must accept the Privacy Policy and Terms of Service before submitting." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(
      "id, name, industry, business_model, registration_country, customer_market_countries, employee_count, stage, revenue_range_band, customer_type, main_tools_stack, team_structure_summary",
    )
    .eq("id", input.companyId)
    .eq("user_id", user.id)
    .single();
  if (companyError || !company) return { success: false, error: "Company not found." };

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("primary_goal, secondary_goal, urgency_level, target_metric, time_horizon, success_definition, desired_future_state_primary, desired_future_state_secondary")
    .eq("id", input.goalId)
    .eq("company_id", input.companyId)
    .single();
  if (goalError || !goal) return { success: false, error: "Goal not found." };

  // Privacy & Consent acknowledgment gate (spec §1.8, confirmed 2026-08-03)
  // — stamped here, at the actual point of first real evidence submission,
  // not at company creation. Only writes it the first time.
  await supabase
    .from("companies")
    .update({ privacy_acknowledged_at: new Date().toISOString() })
    .eq("id", input.companyId)
    .is("privacy_acknowledged_at", null);

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

  try {
    const result = await runAudit({
      companyId: input.companyId,
      company: companyProfile,
      goalId: input.goalId,
      goal: goalContext,
      financial: { evidenceFields: input.financial.evidenceFields, metrics: NO_METRICS },
      execution: { evidenceFields: input.execution.evidenceFields, metrics: NO_METRICS },
      product: { evidenceFields: input.product.evidenceFields, metrics: NO_METRICS },
      commercial: { selfReport: input.commercial, independentResearch: [] },
      aiGovernance: input.aiGovernance,
    });
    return { success: true, reportId: result.reportId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
