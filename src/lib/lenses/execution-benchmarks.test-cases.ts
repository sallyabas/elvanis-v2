/**
 * Committed test-case suite for compareExecutionMetric (confirmed
 * 2026-08-06, ahead of migrating EXECUTION_BENCHMARKS to the DB) — same
 * precedent as jurisdiction.test-cases.ts. Tests the pure function directly
 * against DEFAULT_EXECUTION_BENCHMARKS — no DB dependency. Run with:
 *   npx tsx --env-file=.env.local src/lib/lenses/execution-benchmarks.test-cases.ts
 */
import { compareExecutionMetric, DEFAULT_EXECUTION_BENCHMARKS } from "./execution-benchmarks";

interface TestCase {
  name: string;
  metricKey: string;
  value: number;
  expectedTier: string;
}

const CASES: TestCase[] = [
  // delivery_lead_time_for_changes_days: top_percentile (<1), high_percentile (<=7), below_median (>7)
  { name: "lead time 0.5d -> top_percentile", metricKey: "delivery_lead_time_for_changes_days", value: 0.5, expectedTier: "top_percentile" },
  { name: "lead time 1d (boundary) -> high_percentile, not top_percentile", metricKey: "delivery_lead_time_for_changes_days", value: 1, expectedTier: "high_percentile" },
  { name: "lead time 7d (boundary) -> high_percentile", metricKey: "delivery_lead_time_for_changes_days", value: 7, expectedTier: "high_percentile" },
  { name: "lead time 7.1d -> below_median", metricKey: "delivery_lead_time_for_changes_days", value: 7.1, expectedTier: "below_median" },
  { name: "lead time 10d -> below_median", metricKey: "delivery_lead_time_for_changes_days", value: 10, expectedTier: "below_median" },

  // pr_cycle_time_hours: elite (<25), good (<=72), fair (<=161), poor (>161)
  { name: "PR cycle 24h -> elite", metricKey: "pr_cycle_time_hours", value: 24, expectedTier: "elite" },
  { name: "PR cycle 25h (boundary) -> good, not elite", metricKey: "pr_cycle_time_hours", value: 25, expectedTier: "good" },
  { name: "PR cycle 72h (boundary) -> good", metricKey: "pr_cycle_time_hours", value: 72, expectedTier: "good" },
  { name: "PR cycle 73h -> fair", metricKey: "pr_cycle_time_hours", value: 73, expectedTier: "fair" },
  { name: "PR cycle 161h (boundary) -> fair", metricKey: "pr_cycle_time_hours", value: 161, expectedTier: "fair" },
  { name: "PR cycle 162h -> poor", metricKey: "pr_cycle_time_hours", value: 162, expectedTier: "poor" },

  // pr_review_pickup_time_hours: elite (<7), better_than_average (<105.6), worse_than_average (>=105.6)
  { name: "PR pickup 6h -> elite", metricKey: "pr_review_pickup_time_hours", value: 6, expectedTier: "elite" },
  { name: "PR pickup 7h (boundary) -> better_than_average, not elite", metricKey: "pr_review_pickup_time_hours", value: 7, expectedTier: "better_than_average" },
  { name: "PR pickup 105h -> better_than_average", metricKey: "pr_review_pickup_time_hours", value: 105, expectedTier: "better_than_average" },
  { name: "PR pickup 105.6h (boundary) -> worse_than_average", metricKey: "pr_review_pickup_time_hours", value: 105.6, expectedTier: "worse_than_average" },
  { name: "PR pickup 200h -> worse_than_average", metricKey: "pr_review_pickup_time_hours", value: 200, expectedTier: "worse_than_average" },

  // decision_approval_latency_hours: acceptable (<=48), warning (<=168), crisis (>168)
  { name: "decision latency 48h (boundary) -> acceptable", metricKey: "decision_approval_latency_hours", value: 48, expectedTier: "acceptable" },
  { name: "decision latency 49h -> warning", metricKey: "decision_approval_latency_hours", value: 49, expectedTier: "warning" },
  { name: "decision latency 168h (boundary) -> warning, not crisis", metricKey: "decision_approval_latency_hours", value: 168, expectedTier: "warning" },
  { name: "decision latency 169h -> crisis", metricKey: "decision_approval_latency_hours", value: 169, expectedTier: "crisis" },

  // weekly_meeting_hours_per_manager: below_average (<9), typical (<=13), above_average (>13)
  { name: "meeting load 8h/wk -> below_average", metricKey: "weekly_meeting_hours_per_manager", value: 8, expectedTier: "below_average" },
  { name: "meeting load 9h/wk (boundary) -> typical, not below_average", metricKey: "weekly_meeting_hours_per_manager", value: 9, expectedTier: "typical" },
  { name: "meeting load 13h/wk (boundary) -> typical", metricKey: "weekly_meeting_hours_per_manager", value: 13, expectedTier: "typical" },
  { name: "meeting load 14h/wk -> above_average", metricKey: "weekly_meeting_hours_per_manager", value: 14, expectedTier: "above_average" },
];

function main() {
  let failures = 0;

  for (const c of CASES) {
    const result = compareExecutionMetric(DEFAULT_EXECUTION_BENCHMARKS, c.metricKey, c.value);
    if (result === null) {
      failures++;
      console.log(`FAIL — ${c.name}: got null (unrecognized metricKey)`);
      continue;
    }
    if (result.tier === c.expectedTier) {
      console.log(`PASS — ${c.name}`);
    } else {
      failures++;
      console.log(`FAIL — ${c.name}: expected tier "${c.expectedTier}", got "${result.tier}"`);
    }
  }

  const unrecognized = compareExecutionMetric(DEFAULT_EXECUTION_BENCHMARKS, "not_a_real_metric", 42);
  const unrecognizedOk = unrecognized === null;
  console.log(unrecognizedOk ? "PASS — unrecognized metricKey returns null" : "FAIL — unrecognized metricKey did not return null");
  if (!unrecognizedOk) failures++;

  const total = CASES.length + 1;
  console.log(`\n${total - failures}/${total} passed.`);
  if (failures > 0) process.exit(1);
}

main();
