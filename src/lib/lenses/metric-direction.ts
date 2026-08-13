import { EVIDENCE_FIELD_SETS } from "@/lib/evidence/field-sets";

/**
 * Metric direction lookup (confirmed 2026-08-13, item 2 of the
 * old-Elvanis-inspired batch) — a small, curated "is a higher or lower
 * value better" map for each of the 13 known numeric metric keys, needed
 * for the structured goal-metric capture step + trend display: showing a
 * client "gross margin: 58% → 62%" is more honest with a direction cue
 * than a bare number pair, since a reader shouldn't have to already know
 * whether growth in a given metric is good or bad news.
 *
 * Deliberately NOT a second, hand-typed list of the 13 metric keys —
 * EVIDENCE_FIELD_SETS (src/lib/evidence/field-sets.ts) is already the
 * single source of truth for that (itself copied verbatim from
 * FinancialMetricKey/ExecutionMetricKey/ProductMetricKey, per that file's
 * own docblock), so this module derives its own key list FROM it rather
 * than risking a third copy drifting out of sync.
 */
export type MetricDirection = "higher_is_better" | "lower_is_better";

export interface MetricDefinition {
  metricKey: string;
  label: string;
  unit: string;
  lens: "financial" | "execution" | "product";
  direction: MetricDirection;
}

const DIRECTIONS: Record<string, MetricDirection> = {
  gross_margin_percent: "higher_is_better",
  cash_runway_months: "higher_is_better",
  customer_concentration_percent: "lower_is_better",
  delivery_lead_time_for_changes_days: "lower_is_better",
  pr_cycle_time_hours: "lower_is_better",
  pr_review_pickup_time_hours: "lower_is_better",
  decision_approval_latency_hours: "lower_is_better",
  weekly_meeting_hours_per_manager: "lower_is_better",
  annual_logo_churn_percent: "lower_is_better",
  nps_score: "higher_is_better",
  core_feature_adoption_percent: "higher_is_better",
  activation_rate_percent: "higher_is_better",
  support_csat_percent: "higher_is_better",
};

function directionFor(metricKey: string): MetricDirection {
  const direction = DIRECTIONS[metricKey];
  if (direction) return direction;
  // A metric present in EVIDENCE_FIELD_SETS but missing from DIRECTIONS is
  // a real config error worth surfacing loudly at dev time rather than
  // silently defaulting — but this codebase's standing discipline is
  // defensive fallbacks over hard crashes for anything reaching a real
  // client, so this falls back to "higher_is_better" (the more common case
  // among the 13) with a console warning, not a thrown error.
  console.warn(`metric-direction: no direction defined for "${metricKey}", defaulting to higher_is_better`);
  return "higher_is_better";
}

/** All 13 known metric definitions, grouped by lens in the same order as EVIDENCE_FIELD_SETS. Built once at module load, not recomputed per call. */
export const ALL_METRIC_DEFINITIONS: MetricDefinition[] = EVIDENCE_FIELD_SETS.flatMap((set) =>
  set.metrics.map((m) => ({
    metricKey: m.metricKey,
    label: m.label,
    unit: m.unit,
    lens: set.lens,
    direction: directionFor(m.metricKey),
  })),
);

export function findMetricDefinition(metricKey: string): MetricDefinition | null {
  return ALL_METRIC_DEFINITIONS.find((m) => m.metricKey === metricKey) ?? null;
}
