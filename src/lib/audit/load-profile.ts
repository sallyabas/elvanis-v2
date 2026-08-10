import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanyProfileForLens, GoalContext } from "@/lib/lenses/types";

/**
 * Shared company/goal profile loader (confirmed 2026-08-10, delayed-
 * execution architecture) — extracted from rerunAudit(), which had this
 * exact block, and now also needed by run-pending-audits.ts. Rather than
 * let a third copy drift into existence (the same class of risk this
 * codebase has fixed before — e.g. the shared regions module extracted
 * for Tender Readiness/Data Protection Compliance), one real shared
 * implementation. Always reads the CURRENT profile, never a cached copy —
 * the "business profile is a living record" principle applies here too:
 * a delayed audit run should reflect the company's profile as of when the
 * audit actually executes, not as of when evidence was first submitted.
 */
export async function loadCompanyProfileForLens(supabase: SupabaseClient, companyId: string): Promise<CompanyProfileForLens> {
  const { data: company, error } = await supabase
    .from("companies")
    .select(
      "id, name, industry, business_model, registration_country, customer_market_countries, employee_count, stage, revenue_range_band, customer_type, main_tools_stack, team_structure_summary",
    )
    .eq("id", companyId)
    .single();
  if (error || !company) throw new Error(`loadCompanyProfileForLens: company not found: ${error?.message}`);

  return {
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
}

export async function loadGoalContext(supabase: SupabaseClient, goalId: string): Promise<GoalContext> {
  const { data: goal, error } = await supabase
    .from("goals")
    .select(
      "primary_goal, secondary_goal, urgency_level, target_metric, time_horizon, success_definition, desired_future_state_primary, desired_future_state_secondary",
    )
    .eq("id", goalId)
    .single();
  if (error || !goal) throw new Error(`loadGoalContext: goal not found: ${error?.message}`);

  return {
    primaryGoal: goal.primary_goal,
    secondaryGoal: goal.secondary_goal,
    urgencyLevel: goal.urgency_level,
    targetMetric: goal.target_metric,
    timeHorizon: goal.time_horizon,
    successDefinition: goal.success_definition,
    desiredFutureStatePrimary: goal.desired_future_state_primary,
    desiredFutureStateSecondary: goal.desired_future_state_secondary,
  };
}
