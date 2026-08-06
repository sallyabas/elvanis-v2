/**
 * Committed test-case suite for compareFinancialMetric (confirmed
 * 2026-08-06, ahead of migrating FINANCIAL_BENCHMARKS to the DB) — same
 * precedent as jurisdiction.test-cases.ts: a plain, runnable, committed
 * script (not a scratch file), covering every tier boundary explicitly so
 * a future edit to the DB-backed values (or the comparison logic itself)
 * has real regression coverage, not just a "measurably improved" prompt
 * claim. Tests the pure function directly against DEFAULT_FINANCIAL_BENCHMARKS
 * — no DB dependency, no live server needed. Run with:
 *   npx tsx --env-file=.env.local src/lib/lenses/financial-benchmarks.test-cases.ts
 */
import { compareFinancialMetric, DEFAULT_FINANCIAL_BENCHMARKS } from "./financial-benchmarks";

interface TestCase {
  name: string;
  metricKey: string;
  value: number;
  expectedTier: string;
}

const CASES: TestCase[] = [
  // gross_margin_percent: concerning (<60), flag (60-<70), healthy (>=70)
  { name: "gross margin 59% -> concerning", metricKey: "gross_margin_percent", value: 59, expectedTier: "concerning" },
  { name: "gross margin 60% (boundary) -> flag, not concerning", metricKey: "gross_margin_percent", value: 60, expectedTier: "flag" },
  { name: "gross margin 69% -> flag", metricKey: "gross_margin_percent", value: 69, expectedTier: "flag" },
  { name: "gross margin 70% (boundary) -> healthy, not flag", metricKey: "gross_margin_percent", value: 70, expectedTier: "healthy" },
  { name: "gross margin 85% -> healthy", metricKey: "gross_margin_percent", value: 85, expectedTier: "healthy" },

  // cash_runway_months: critical (<6), warning (6-<12), healthy (>=12)
  { name: "runway 5mo -> critical", metricKey: "cash_runway_months", value: 5, expectedTier: "critical" },
  { name: "runway 6mo (boundary) -> warning, not critical", metricKey: "cash_runway_months", value: 6, expectedTier: "warning" },
  { name: "runway 11mo -> warning", metricKey: "cash_runway_months", value: 11, expectedTier: "warning" },
  { name: "runway 12mo (boundary) -> healthy, not warning", metricKey: "cash_runway_months", value: 12, expectedTier: "healthy" },
  { name: "runway 18mo -> healthy", metricKey: "cash_runway_months", value: 18, expectedTier: "healthy" },

  // customer_concentration_percent: healthy (<10), watch (10-<25), elevated_risk (25-<35), critical (>=35)
  { name: "concentration 9% -> healthy", metricKey: "customer_concentration_percent", value: 9, expectedTier: "healthy" },
  { name: "concentration 10% (boundary) -> watch, not healthy", metricKey: "customer_concentration_percent", value: 10, expectedTier: "watch" },
  { name: "concentration 24% -> watch", metricKey: "customer_concentration_percent", value: 24, expectedTier: "watch" },
  { name: "concentration 25% (boundary) -> elevated_risk, not watch", metricKey: "customer_concentration_percent", value: 25, expectedTier: "elevated_risk" },
  { name: "concentration 34% -> elevated_risk", metricKey: "customer_concentration_percent", value: 34, expectedTier: "elevated_risk" },
  { name: "concentration 35% (boundary) -> critical, not elevated_risk", metricKey: "customer_concentration_percent", value: 35, expectedTier: "critical" },
  { name: "concentration 50% -> critical", metricKey: "customer_concentration_percent", value: 50, expectedTier: "critical" },
];

function main() {
  let failures = 0;

  for (const c of CASES) {
    const result = compareFinancialMetric(DEFAULT_FINANCIAL_BENCHMARKS, c.metricKey, c.value);
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

  // Unrecognized metric key returns null, never throws or guesses a tier.
  const unrecognized = compareFinancialMetric(DEFAULT_FINANCIAL_BENCHMARKS, "not_a_real_metric", 42);
  const unrecognizedOk = unrecognized === null;
  console.log(unrecognizedOk ? "PASS — unrecognized metricKey returns null" : "FAIL — unrecognized metricKey did not return null");
  if (!unrecognizedOk) failures++;

  const total = CASES.length + 1;
  console.log(`\n${total - failures}/${total} passed.`);
  if (failures > 0) process.exit(1);
}

main();
