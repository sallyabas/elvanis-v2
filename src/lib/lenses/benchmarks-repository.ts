import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FINANCIAL_BENCHMARKS, type FinancialBenchmarks } from "./financial-benchmarks";
import { DEFAULT_EXECUTION_BENCHMARKS, type ExecutionBenchmarks } from "./execution-benchmarks";
import { DEFAULT_PRODUCT_BENCHMARKS, type ProductBenchmarks } from "./product-benchmarks";
import {
  DEFAULT_GOVERNANCE_DIMENSIONS,
  DEFAULT_GOVERNANCE_MATURITY_TIER_BOUNDARIES,
  GOVERNANCE_DIMENSION_KEYS,
  type GovernanceDimensionDefinition,
  type GovernanceDimensionKey,
  type GovernanceMaturityTierBoundaries,
} from "./ai-governance-framework";

/**
 * Server-only DB loaders for lens_benchmarks/governance_dimensions
 * (confirmed 2026-08-06, closing the hardcoded-values audit's #1 finding).
 * Same "admin-adjustable, not a constant" principle as app-settings.ts —
 * and the same defensive-fallback discipline: a DB hiccup here must never
 * take down a lens run, so every loader falls back to the DEFAULT_*
 * constant (which is also the seed data's own documented source of truth)
 * on any read failure or incomplete row set, logging the fallback rather
 * than silently swallowing it.
 *
 * Explicit (metric_key, boundary_key) -> field mapping per lens, not a
 * generic reflection-based reshape — verbose, but matches this codebase's
 * standing preference for explicit, auditable code over cleverness, and
 * means a typo'd DB row is simply ignored (falls back to the default for
 * that one field) rather than silently corrupting an unrelated field.
 */

interface BenchmarkRow {
  lens: string;
  metric_key: string;
  boundary_key: string;
  value: number;
}

async function fetchRows(lens: string): Promise<BenchmarkRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("lens_benchmarks").select("lens, metric_key, boundary_key, value").eq("lens", lens);
  if (error) {
    console.error(`benchmarks-repository: failed to load "${lens}" lens_benchmarks, falling back to defaults: ${error.message}`);
    return [];
  }
  return (data ?? []) as BenchmarkRow[];
}

function findValue(rows: BenchmarkRow[], metricKey: string, boundaryKey: string): number | undefined {
  return rows.find((r) => r.metric_key === metricKey && r.boundary_key === boundaryKey)?.value;
}

export async function loadFinancialBenchmarks(): Promise<FinancialBenchmarks> {
  const rows = await fetchRows("financial");
  const b: FinancialBenchmarks = structuredClone(DEFAULT_FINANCIAL_BENCHMARKS);

  const gm = findValue(rows, "gross_margin_percent", "healthy_min");
  if (gm !== undefined) b.grossMarginPercent.healthyMin = gm;
  const gmMax = findValue(rows, "gross_margin_percent", "healthy_max");
  if (gmMax !== undefined) b.grossMarginPercent.healthyMax = gmMax;
  const gmFlag = findValue(rows, "gross_margin_percent", "flag_below");
  if (gmFlag !== undefined) b.grossMarginPercent.flagBelow = gmFlag;
  const gmConcerning = findValue(rows, "gross_margin_percent", "concerning_below");
  if (gmConcerning !== undefined) b.grossMarginPercent.concerningBelow = gmConcerning;

  const rwCritical = findValue(rows, "cash_runway_months", "critical_below");
  if (rwCritical !== undefined) b.runwayMonths.criticalBelow = rwCritical;
  const rwWarning = findValue(rows, "cash_runway_months", "warning_below");
  if (rwWarning !== undefined) b.runwayMonths.warningBelow = rwWarning;
  const rwHealthy = findValue(rows, "cash_runway_months", "healthy_at_or_above");
  if (rwHealthy !== undefined) b.runwayMonths.healthyAtOrAbove = rwHealthy;

  const ccHealthy = findValue(rows, "customer_concentration_percent", "healthy_below");
  if (ccHealthy !== undefined) b.customerConcentrationPercent.healthyBelow = ccHealthy;
  const ccWatch = findValue(rows, "customer_concentration_percent", "watch_below");
  if (ccWatch !== undefined) b.customerConcentrationPercent.watchBelow = ccWatch;
  const ccElevated = findValue(rows, "customer_concentration_percent", "elevated_risk_below");
  if (ccElevated !== undefined) b.customerConcentrationPercent.elevatedRiskBelow = ccElevated;
  const ccCritical = findValue(rows, "customer_concentration_percent", "critical_at_or_above");
  if (ccCritical !== undefined) b.customerConcentrationPercent.criticalAtOrAbove = ccCritical;

  return b;
}

export async function loadExecutionBenchmarks(): Promise<ExecutionBenchmarks> {
  const rows = await fetchRows("execution");
  const b: ExecutionBenchmarks = structuredClone(DEFAULT_EXECUTION_BENCHMARKS);

  const topPct = findValue(rows, "delivery_lead_time_for_changes_days", "top_percentile_under_days");
  if (topPct !== undefined) b.deliveryLeadTimeForChangesDays.topPercentileUnderDays = topPct;
  const highPct = findValue(rows, "delivery_lead_time_for_changes_days", "high_percentile_under_days");
  if (highPct !== undefined) b.deliveryLeadTimeForChangesDays.highPercentileUnderDays = highPct;

  const cycleElite = findValue(rows, "pr_cycle_time_hours", "elite_below");
  if (cycleElite !== undefined) b.prCycleTimeHours.eliteBelow = cycleElite;
  const goodMin = findValue(rows, "pr_cycle_time_hours", "good_range_min");
  const goodMax = findValue(rows, "pr_cycle_time_hours", "good_range_max");
  if (goodMin !== undefined && goodMax !== undefined) b.prCycleTimeHours.goodRange = [goodMin, goodMax];
  const fairMin = findValue(rows, "pr_cycle_time_hours", "fair_range_min");
  const fairMax = findValue(rows, "pr_cycle_time_hours", "fair_range_max");
  if (fairMin !== undefined && fairMax !== undefined) b.prCycleTimeHours.fairRange = [fairMin, fairMax];
  const poorAbove = findValue(rows, "pr_cycle_time_hours", "poor_above");
  if (poorAbove !== undefined) b.prCycleTimeHours.poorAbove = poorAbove;

  const pickupElite = findValue(rows, "pr_review_pickup_time_hours", "elite_below");
  if (pickupElite !== undefined) b.prReviewPickupTimeHours.eliteBelow = pickupElite;
  const pickupAvg = findValue(rows, "pr_review_pickup_time_hours", "industry_average_hours");
  if (pickupAvg !== undefined) b.prReviewPickupTimeHours.industryAverageHours = pickupAvg;

  const warningAt = findValue(rows, "decision_approval_latency_hours", "warning_at_hours");
  if (warningAt !== undefined) b.decisionApprovalLatencyHours.warningAtHours = warningAt;
  const crisisAt = findValue(rows, "decision_approval_latency_hours", "crisis_at_hours");
  if (crisisAt !== undefined) b.decisionApprovalLatencyHours.crisisAtHours = crisisAt;

  const cwMin = findValue(rows, "meeting_load_hours_per_week", "company_wide_average_min");
  const cwMax = findValue(rows, "meeting_load_hours_per_week", "company_wide_average_max");
  if (cwMin !== undefined && cwMax !== undefined) b.meetingLoadHoursPerWeek.companyWideAverage = [cwMin, cwMax];
  const icAvg = findValue(rows, "meeting_load_hours_per_week", "individual_contributor_average");
  if (icAvg !== undefined) b.meetingLoadHoursPerWeek.individualContributorAverage = icAvg;
  const mgrMin = findValue(rows, "meeting_load_hours_per_week", "manager_range_min");
  const mgrMax = findValue(rows, "meeting_load_hours_per_week", "manager_range_max");
  if (mgrMin !== undefined && mgrMax !== undefined) b.meetingLoadHoursPerWeek.managerRange = [mgrMin, mgrMax];
  const cSuite = findValue(rows, "meeting_load_hours_per_week", "c_suite_average");
  if (cSuite !== undefined) b.meetingLoadHoursPerWeek.cSuiteAverage = cSuite;

  return b;
}

export async function loadProductBenchmarks(): Promise<ProductBenchmarks> {
  const rows = await fetchRows("product");
  const b: ProductBenchmarks = structuredClone(DEFAULT_PRODUCT_BENCHMARKS);

  const churnHealthy = findValue(rows, "annual_logo_churn_percent", "healthy_below");
  if (churnHealthy !== undefined) b.annualLogoChurnPercent.healthyBelow = churnHealthy;
  const churnWatch = findValue(rows, "annual_logo_churn_percent", "watch_below");
  if (churnWatch !== undefined) b.annualLogoChurnPercent.watchBelow = churnWatch;
  const churnConcerning = findValue(rows, "annual_logo_churn_percent", "concerning_below");
  if (churnConcerning !== undefined) b.annualLogoChurnPercent.concerningBelow = churnConcerning;

  const npsConcerning = findValue(rows, "nps_score", "concerning_below");
  if (npsConcerning !== undefined) b.npsScore.concerningBelow = npsConcerning;
  const npsAverage = findValue(rows, "nps_score", "average_below");
  if (npsAverage !== undefined) b.npsScore.averageBelow = npsAverage;
  const npsGood = findValue(rows, "nps_score", "good_below");
  if (npsGood !== undefined) b.npsScore.goodBelow = npsGood;
  const npsExcellent = findValue(rows, "nps_score", "excellent_at_or_above");
  if (npsExcellent !== undefined) b.npsScore.excellentAtOrAbove = npsExcellent;

  const adoptionConcerning = findValue(rows, "core_feature_adoption_percent", "concerning_below");
  if (adoptionConcerning !== undefined) b.coreFeatureAdoptionPercent.concerningBelow = adoptionConcerning;
  const adoptionMedian = findValue(rows, "core_feature_adoption_percent", "below_median_below");
  if (adoptionMedian !== undefined) b.coreFeatureAdoptionPercent.belowMedianBelow = adoptionMedian;
  const adoptionAbove = findValue(rows, "core_feature_adoption_percent", "above_average_at_or_above");
  if (adoptionAbove !== undefined) b.coreFeatureAdoptionPercent.aboveAverageAtOrAbove = adoptionAbove;
  const adoptionTop = findValue(rows, "core_feature_adoption_percent", "top_quartile_at_or_above");
  if (adoptionTop !== undefined) b.coreFeatureAdoptionPercent.topQuartileAtOrAbove = adoptionTop;

  const actConcerning = findValue(rows, "activation_rate_percent", "concerning_below");
  if (actConcerning !== undefined) b.activationRatePercent.concerningBelow = actConcerning;
  const actBelowAvg = findValue(rows, "activation_rate_percent", "below_average_below");
  if (actBelowAvg !== undefined) b.activationRatePercent.belowAverageBelow = actBelowAvg;
  const actGood = findValue(rows, "activation_rate_percent", "good_at_or_above");
  if (actGood !== undefined) b.activationRatePercent.goodAtOrAbove = actGood;
  const actExcellent = findValue(rows, "activation_rate_percent", "excellent_at_or_above");
  if (actExcellent !== undefined) b.activationRatePercent.excellentAtOrAbove = actExcellent;

  const csatConcerning = findValue(rows, "support_csat_percent", "concerning_below");
  if (csatConcerning !== undefined) b.supportCsatPercent.concerningBelow = csatConcerning;
  const csatAverage = findValue(rows, "support_csat_percent", "average_below");
  if (csatAverage !== undefined) b.supportCsatPercent.averageBelow = csatAverage;
  const csatGood = findValue(rows, "support_csat_percent", "good_at_or_above");
  if (csatGood !== undefined) b.supportCsatPercent.goodAtOrAbove = csatGood;

  return b;
}

export async function loadGovernanceMaturityTierBoundaries(): Promise<GovernanceMaturityTierBoundaries> {
  const rows = await fetchRows("ai_governance");
  const boundaries: GovernanceMaturityTierBoundaries = { ...DEFAULT_GOVERNANCE_MATURITY_TIER_BOUNDARIES };

  const nascentMax = findValue(rows, "overall_maturity_total_score", "nascent_max");
  if (nascentMax !== undefined) boundaries.nascentMax = nascentMax;
  const developingMax = findValue(rows, "overall_maturity_total_score", "developing_max");
  if (developingMax !== undefined) boundaries.developingMax = developingMax;
  const establishedMax = findValue(rows, "overall_maturity_total_score", "established_max");
  if (establishedMax !== undefined) boundaries.establishedMax = establishedMax;

  return boundaries;
}

interface GovernanceDimensionRow {
  dimension_key: string;
  label: string;
  source: string;
  sort_order: number;
  level_0: string;
  level_1: string;
  level_2: string;
  level_3: string;
}

/** Recognized keys only — an unrecognized dimension_key in the DB is dropped, never trusted blindly (GovernanceDimensionKey stays a fixed structural type, see ai-governance-framework.ts). */
function isKnownDimensionKey(key: string): key is GovernanceDimensionKey {
  return (GOVERNANCE_DIMENSION_KEYS as string[]).includes(key);
}

export async function loadGovernanceDimensions(): Promise<GovernanceDimensionDefinition[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("governance_dimensions").select("*").order("sort_order", { ascending: true });
  if (error) {
    console.error(`benchmarks-repository: failed to load governance_dimensions, falling back to defaults: ${error.message}`);
    return DEFAULT_GOVERNANCE_DIMENSIONS;
  }

  const rows = (data ?? []) as GovernanceDimensionRow[];
  const defs: GovernanceDimensionDefinition[] = rows
    .filter((r) => isKnownDimensionKey(r.dimension_key))
    .map((r) => ({
      key: r.dimension_key as GovernanceDimensionKey,
      label: r.label,
      source: r.source,
      levels: [r.level_0, r.level_1, r.level_2, r.level_3] as [string, string, string, string],
    }));

  // Defensive: if the DB is missing rows (or all 7 known keys aren't present), fall back to the full default set rather than running with a partial rubric.
  if (defs.length !== GOVERNANCE_DIMENSION_KEYS.length) {
    console.error(`benchmarks-repository: governance_dimensions returned ${defs.length}/${GOVERNANCE_DIMENSION_KEYS.length} recognized rows, falling back to defaults`);
    return DEFAULT_GOVERNANCE_DIMENSIONS;
  }

  return defs;
}
