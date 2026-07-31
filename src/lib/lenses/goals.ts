import type { GoalContext, PrimaryGoal } from "./types";

/** Human-readable labels + framing for the goal menu, shared across all five lenses. */
export const GOAL_LABELS: Record<PrimaryGoal, string> = {
  cash_flow_margin_efficiency: "Cash Flow / Margin Efficiency",
  growth_revenue_efficiency: "Growth / Revenue Efficiency",
  churn_retention: "Churn / Retention",
  execution_speed: "Execution Speed",
  product_delivery: "Product Delivery",
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
