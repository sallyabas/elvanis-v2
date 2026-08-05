import type { GoalContext, PrimaryGoal } from "./types";

/** Human-readable labels + framing for the goal menu, shared across all five lenses. */
export const GOAL_LABELS: Record<PrimaryGoal, string> = {
  cash_flow_margin_efficiency: "Cash Flow / Margin Efficiency",
  growth_revenue_efficiency: "Growth / Revenue Efficiency",
  churn_retention: "Churn / Retention",
  execution_speed: "Execution Speed",
  product_delivery: "Product Delivery",
};

/**
 * One-line, client-facing framing per goal — used by the onboarding goal
 * wizard (pulled forward from V2 "Goal definition wizard," confirmed
 * 2026-08-05) so a client picking a goal understands what it actually
 * means before committing to it, not just a bare label. Deliberately plain
 * business language, not lens-internal terminology.
 */
export const GOAL_DESCRIPTIONS: Record<PrimaryGoal, string> = {
  cash_flow_margin_efficiency: "Improve gross margin, reduce burn, or extend runway.",
  growth_revenue_efficiency: "Grow revenue more efficiently — better win rates, CAC, or deal velocity.",
  churn_retention: "Reduce customer churn and improve retention.",
  execution_speed: "Ship and decide faster — cut delivery cycle time and decision latency.",
  product_delivery: "Improve how reliably and predictably the roadmap actually ships.",
};

/**
 * Example target metrics per goal — shown as placeholder/help text in the
 * wizard's "target metric" step, not a fixed enum (the field stays
 * free-text; these are illustrative, not exhaustive or mandatory).
 */
export const GOAL_METRIC_EXAMPLES: Record<PrimaryGoal, string> = {
  cash_flow_margin_efficiency: "e.g. gross margin %, monthly burn, runway in months",
  growth_revenue_efficiency: "e.g. MRR growth rate, CAC:LTV ratio, win rate",
  churn_retention: "e.g. monthly logo churn %, net revenue retention",
  execution_speed: "e.g. average decision turnaround time, delivery cycle time",
  product_delivery: "e.g. feature adoption rate, roadmap-to-ship cycle time",
};

export function formatGoalContextForPrompt(goal: GoalContext): string {
  const lines = [
    `Primary goal: ${GOAL_LABELS[goal.primaryGoal]}`,
    goal.secondaryGoal ? `Secondary goal: ${GOAL_LABELS[goal.secondaryGoal]}` : null,
    goal.targetMetric ? `Target metric: ${goal.targetMetric}` : null,
    goal.timeHorizon ? `Time horizon: ${goal.timeHorizon}` : null,
    goal.urgencyLevel ? `Urgency: ${goal.urgencyLevel}` : null,
    goal.successDefinition ? `Success looks like: ${goal.successDefinition}` : null,
  ].filter((line): line is string => line !== null);

  return lines.join("\n");
}
