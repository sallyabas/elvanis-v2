/**
 * Committed test-case suite for compareProductMetric (confirmed 2026-08-06,
 * ahead of migrating PRODUCT_BENCHMARKS to the DB) — same precedent as
 * jurisdiction.test-cases.ts. CLAUDE.md previously referenced "21
 * deterministic tier-boundary cases unit-tested and passing" for this lens,
 * but no such file was ever actually committed — that gap is what this file
 * closes for real. Tests the pure function directly against
 * DEFAULT_PRODUCT_BENCHMARKS — no DB dependency. Run with:
 *   npx tsx --env-file=.env.local src/lib/lenses/product-benchmarks.test-cases.ts
 */
import { compareProductMetric, DEFAULT_PRODUCT_BENCHMARKS } from "./product-benchmarks";

interface TestCase {
  name: string;
  metricKey: string;
  value: number;
  expectedTier: string;
}

const CASES: TestCase[] = [
  // annual_logo_churn_percent: healthy (<5), watch (<10), concerning (<20), critical (>=20)
  { name: "churn 4% -> healthy", metricKey: "annual_logo_churn_percent", value: 4, expectedTier: "healthy" },
  { name: "churn 5% (boundary) -> watch, not healthy", metricKey: "annual_logo_churn_percent", value: 5, expectedTier: "watch" },
  { name: "churn 9% -> watch", metricKey: "annual_logo_churn_percent", value: 9, expectedTier: "watch" },
  { name: "churn 10% (boundary) -> concerning, not watch", metricKey: "annual_logo_churn_percent", value: 10, expectedTier: "concerning" },
  { name: "churn 19% -> concerning", metricKey: "annual_logo_churn_percent", value: 19, expectedTier: "concerning" },
  { name: "churn 20% (boundary) -> critical, not concerning", metricKey: "annual_logo_churn_percent", value: 20, expectedTier: "critical" },

  // nps_score: critical (<0), concerning (<30), average (<40), good (<55), excellent (>=55)
  { name: "NPS -5 -> critical", metricKey: "nps_score", value: -5, expectedTier: "critical" },
  { name: "NPS 0 (boundary) -> concerning, not critical", metricKey: "nps_score", value: 0, expectedTier: "concerning" },
  { name: "NPS 29 -> concerning", metricKey: "nps_score", value: 29, expectedTier: "concerning" },
  { name: "NPS 30 (boundary) -> average, not concerning", metricKey: "nps_score", value: 30, expectedTier: "average" },
  { name: "NPS 39 -> average", metricKey: "nps_score", value: 39, expectedTier: "average" },
  { name: "NPS 40 (boundary) -> good, not average", metricKey: "nps_score", value: 40, expectedTier: "good" },
  { name: "NPS 54 -> good", metricKey: "nps_score", value: 54, expectedTier: "good" },
  { name: "NPS 55 (boundary) -> excellent, not good", metricKey: "nps_score", value: 55, expectedTier: "excellent" },

  // core_feature_adoption_percent: critical (<10), concerning (<16.5), average (<24.5), good (<45), excellent (>=45)
  { name: "adoption 9% -> critical", metricKey: "core_feature_adoption_percent", value: 9, expectedTier: "critical" },
  { name: "adoption 10% (boundary) -> concerning, not critical", metricKey: "core_feature_adoption_percent", value: 10, expectedTier: "concerning" },
  { name: "adoption 16% -> concerning", metricKey: "core_feature_adoption_percent", value: 16, expectedTier: "concerning" },
  { name: "adoption 16.5% (boundary) -> average, not concerning", metricKey: "core_feature_adoption_percent", value: 16.5, expectedTier: "average" },
  { name: "adoption 24% -> average", metricKey: "core_feature_adoption_percent", value: 24, expectedTier: "average" },
  { name: "adoption 24.5% (boundary) -> good, not average", metricKey: "core_feature_adoption_percent", value: 24.5, expectedTier: "good" },
  { name: "adoption 44% -> good", metricKey: "core_feature_adoption_percent", value: 44, expectedTier: "good" },
  { name: "adoption 45% (boundary) -> excellent, not good", metricKey: "core_feature_adoption_percent", value: 45, expectedTier: "excellent" },

  // activation_rate_percent: critical (<15), concerning (<37), average (<45), good (<55), excellent (>=55)
  { name: "activation 14% -> critical", metricKey: "activation_rate_percent", value: 14, expectedTier: "critical" },
  { name: "activation 15% (boundary) -> concerning, not critical", metricKey: "activation_rate_percent", value: 15, expectedTier: "concerning" },
  { name: "activation 36% -> concerning", metricKey: "activation_rate_percent", value: 36, expectedTier: "concerning" },
  { name: "activation 37% (boundary) -> average, not concerning", metricKey: "activation_rate_percent", value: 37, expectedTier: "average" },
  { name: "activation 44% -> average", metricKey: "activation_rate_percent", value: 44, expectedTier: "average" },
  { name: "activation 45% (boundary) -> good, not average", metricKey: "activation_rate_percent", value: 45, expectedTier: "good" },
  { name: "activation 54% -> good", metricKey: "activation_rate_percent", value: 54, expectedTier: "good" },
  { name: "activation 55% (boundary) -> excellent, not good", metricKey: "activation_rate_percent", value: 55, expectedTier: "excellent" },

  // support_csat_percent: concerning (<70), below_average (<77), average (<85), good (>=85)
  { name: "CSAT 69% -> concerning", metricKey: "support_csat_percent", value: 69, expectedTier: "concerning" },
  { name: "CSAT 70% (boundary) -> below_average, not concerning", metricKey: "support_csat_percent", value: 70, expectedTier: "below_average" },
  { name: "CSAT 76% -> below_average", metricKey: "support_csat_percent", value: 76, expectedTier: "below_average" },
  { name: "CSAT 77% (boundary) -> average, not below_average", metricKey: "support_csat_percent", value: 77, expectedTier: "average" },
  { name: "CSAT 84% -> average", metricKey: "support_csat_percent", value: 84, expectedTier: "average" },
  { name: "CSAT 85% (boundary) -> good, not average", metricKey: "support_csat_percent", value: 85, expectedTier: "good" },
];

function main() {
  let failures = 0;

  for (const c of CASES) {
    const result = compareProductMetric(DEFAULT_PRODUCT_BENCHMARKS, c.metricKey, c.value);
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

  const unrecognized = compareProductMetric(DEFAULT_PRODUCT_BENCHMARKS, "not_a_real_metric", 42);
  const unrecognizedOk = unrecognized === null;
  console.log(unrecognizedOk ? "PASS — unrecognized metricKey returns null" : "FAIL — unrecognized metricKey did not return null");
  if (!unrecognizedOk) failures++;

  const total = CASES.length + 1;
  console.log(`\n${total - failures}/${total} passed.`);
  if (failures > 0) process.exit(1);
}

main();
