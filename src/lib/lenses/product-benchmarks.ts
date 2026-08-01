import type { ComputedMetricComparison } from "./metrics";

/**
 * Product/Customer lens reference thresholds — externally published
 * benchmarks (2025/2026 industry reports), pulled because the founder has
 * no first-hand thresholds memorized for this domain either (same treatment
 * as Execution). Explicitly a starting point, not permanent — refine with
 * real pilot audits (roadmap Phase 3) once actual cases exist to compare
 * against. Every figure below is sourced; do not add a number here without
 * a citation.
 */
export const PRODUCT_BENCHMARKS = {
  // Recurly 2025 Churn Report; SaaS retention benchmark aggregates. B2B SaaS
  // median annual logo churn is ~3.5%, "good" is under 5% — but SMB-focused
  // products run structurally higher (SMB segments have been reported at
  // 31-58% annual). Use judgment on customerType; these thresholds are the
  // broad B2B baseline, not segment-adjusted.
  annualLogoChurnPercent: {
    healthyBelow: 5,
    watchBelow: 10,
    concerningBelow: 20,
    source: "Recurly 2025 Churn Report; aggregated 2026 SaaS retention benchmark reports",
  },
  // Retently / SurveySparrow / Sybill 2026 NPS benchmarks. B2B SaaS average
  // ~41; "good" is 40-55, top performers 60+.
  npsScore: {
    concerningBelow: 0,
    averageBelow: 30,
    goodBelow: 40,
    excellentAtOrAbove: 55,
    source: "Retently, SurveySparrow, Sybill 2026 NPS benchmark reports (B2B SaaS average ~41)",
  },
  // Userpilot SaaS Product Metrics Benchmark Report (547 companies, 2024/2025
  // edition). Median core feature adoption 16.5%, average 24.5%, top
  // quartile 45%+.
  coreFeatureAdoptionPercent: {
    concerningBelow: 10,
    belowMedianBelow: 16.5,
    aboveAverageAtOrAbove: 24.5,
    topQuartileAtOrAbove: 45,
    source: "Userpilot SaaS Product Metrics Benchmark Report 2024/2025 (547 companies)",
  },
  // 2025 SaaS/AI tools activation benchmarks. Average 37.5%, median 37%,
  // most companies 15-20%, good 45-55%, excellent 55%+.
  activationRatePercent: {
    concerningBelow: 15,
    belowAverageBelow: 37,
    goodAtOrAbove: 45,
    excellentAtOrAbove: 55,
    source: "2025 SaaS/AI tools activation rate benchmark aggregates",
  },
  // 2025/2026 SaaS CSAT benchmarks. B2B Software & SaaS average CSAT ~77;
  // market leaders 85%+, top firms ~89%.
  supportCsatPercent: {
    concerningBelow: 70,
    averageBelow: 77,
    goodAtOrAbove: 85,
    source: "2025/2026 SaaS CSAT benchmark reports (SurveySparrow, Retently, RevOS) — B2B Software & SaaS average ~77",
  },
} as const;

/** Rendered into the system prompt as general context/scale — not what decides any individual finding's tier. */
export function formatProductBenchmarksForPrompt(): string {
  const b = PRODUCT_BENCHMARKS;
  return [
    `- Annual logo churn: healthy <${b.annualLogoChurnPercent.healthyBelow}%, watch <${b.annualLogoChurnPercent.watchBelow}%, concerning <${b.annualLogoChurnPercent.concerningBelow}%, critical at/above ${b.annualLogoChurnPercent.concerningBelow}% — note SMB-focused customer bases run structurally higher [source: ${b.annualLogoChurnPercent.source}]`,
    `- NPS: critical <${b.npsScore.concerningBelow}, concerning <${b.npsScore.averageBelow}, average <${b.npsScore.goodBelow}, good <${b.npsScore.excellentAtOrAbove}, excellent at/above ${b.npsScore.excellentAtOrAbove} [source: ${b.npsScore.source}]`,
    `- Core feature adoption: critical <${b.coreFeatureAdoptionPercent.concerningBelow}%, concerning <${b.coreFeatureAdoptionPercent.belowMedianBelow}% (below median), average <${b.coreFeatureAdoptionPercent.aboveAverageAtOrAbove}%, good <${b.coreFeatureAdoptionPercent.topQuartileAtOrAbove}%, excellent at/above ${b.coreFeatureAdoptionPercent.topQuartileAtOrAbove}% (top quartile) [source: ${b.coreFeatureAdoptionPercent.source}]`,
    `- Activation rate: critical <${b.activationRatePercent.concerningBelow}%, concerning <${b.activationRatePercent.belowAverageBelow}%, good at/above ${b.activationRatePercent.goodAtOrAbove}%, excellent at/above ${b.activationRatePercent.excellentAtOrAbove}% [source: ${b.activationRatePercent.source}]`,
    `- Support CSAT: concerning <${b.supportCsatPercent.concerningBelow}%, average <${b.supportCsatPercent.averageBelow}%, good at/above ${b.supportCsatPercent.goodAtOrAbove}% [source: ${b.supportCsatPercent.source}]`,
  ].join("\n");
}

export type ProductMetricKey =
  | "annual_logo_churn_percent"
  | "nps_score"
  | "core_feature_adoption_percent"
  | "activation_rate_percent"
  | "support_csat_percent";

/**
 * The actual >, <, tier-lookup comparison, done here in deterministic code —
 * never left to the LLM. Returns null for an unrecognized metricKey (the
 * lens then treats the value as qualitative evidence only, with no asserted
 * benchmark tier).
 */
export function compareProductMetric(metricKey: string, value: number): ComputedMetricComparison | null {
  const b = PRODUCT_BENCHMARKS;

  switch (metricKey as ProductMetricKey) {
    case "annual_logo_churn_percent": {
      const c = b.annualLogoChurnPercent;
      let tier: string;
      let comparisonText: string;
      if (value < c.healthyBelow) {
        tier = "healthy";
        comparisonText = `${value}% is below the ${c.healthyBelow}% healthy threshold`;
      } else if (value < c.watchBelow) {
        tier = "watch";
        comparisonText = `${value}% is between the ${c.healthyBelow}% healthy and ${c.watchBelow}% watch thresholds`;
      } else if (value < c.concerningBelow) {
        tier = "concerning";
        comparisonText = `${value}% is between the ${c.watchBelow}% watch and ${c.concerningBelow}% critical thresholds — concerning`;
      } else {
        tier = "critical";
        comparisonText = `${value}% is at/above the ${c.concerningBelow}% critical threshold`;
      }
      return { metricKey, label: "Annual logo churn", value, unit: "%", tier, comparisonText };
    }

    case "nps_score": {
      const n = b.npsScore;
      let tier: string;
      let comparisonText: string;
      if (value < n.concerningBelow) {
        tier = "critical";
        comparisonText = `${value} is negative — below the ${n.concerningBelow} critical threshold`;
      } else if (value < n.averageBelow) {
        tier = "concerning";
        comparisonText = `${value} is between ${n.concerningBelow} and ${n.averageBelow} — concerning`;
      } else if (value < n.goodBelow) {
        tier = "average";
        comparisonText = `${value} is between ${n.averageBelow} and ${n.goodBelow} — average for B2B SaaS`;
      } else if (value < n.excellentAtOrAbove) {
        tier = "good";
        comparisonText = `${value} is between ${n.goodBelow} and ${n.excellentAtOrAbove} — good`;
      } else {
        tier = "excellent";
        comparisonText = `${value} is at/above ${n.excellentAtOrAbove} — excellent, top-performer range`;
      }
      return { metricKey, label: "NPS", value, unit: "score", tier, comparisonText };
    }

    case "core_feature_adoption_percent": {
      const f = b.coreFeatureAdoptionPercent;
      let tier: string;
      let comparisonText: string;
      if (value < f.concerningBelow) {
        tier = "critical";
        comparisonText = `${value}% is below the ${f.concerningBelow}% critical threshold`;
      } else if (value < f.belowMedianBelow) {
        tier = "concerning";
        comparisonText = `${value}% is below the ${f.belowMedianBelow}% industry median`;
      } else if (value < f.aboveAverageAtOrAbove) {
        tier = "average";
        comparisonText = `${value}% is between the ${f.belowMedianBelow}% median and ${f.aboveAverageAtOrAbove}% average`;
      } else if (value < f.topQuartileAtOrAbove) {
        tier = "good";
        comparisonText = `${value}% is between the ${f.aboveAverageAtOrAbove}% average and ${f.topQuartileAtOrAbove}% top-quartile mark`;
      } else {
        tier = "excellent";
        comparisonText = `${value}% is at/above the ${f.topQuartileAtOrAbove}% top-quartile mark`;
      }
      return { metricKey, label: "Core feature adoption", value, unit: "%", tier, comparisonText };
    }

    case "activation_rate_percent": {
      const a = b.activationRatePercent;
      let tier: string;
      let comparisonText: string;
      if (value < a.concerningBelow) {
        tier = "critical";
        comparisonText = `${value}% is below the ${a.concerningBelow}% critical threshold`;
      } else if (value < a.belowAverageBelow) {
        tier = "concerning";
        comparisonText = `${value}% is below the ${a.belowAverageBelow}% industry average`;
      } else if (value < a.goodAtOrAbove) {
        tier = "average";
        comparisonText = `${value}% is between the ${a.belowAverageBelow}% average and ${a.goodAtOrAbove}% good threshold`;
      } else if (value < a.excellentAtOrAbove) {
        tier = "good";
        comparisonText = `${value}% is between the ${a.goodAtOrAbove}% and ${a.excellentAtOrAbove}% thresholds — good`;
      } else {
        tier = "excellent";
        comparisonText = `${value}% is at/above the ${a.excellentAtOrAbove}% excellent threshold`;
      }
      return { metricKey, label: "Activation rate", value, unit: "%", tier, comparisonText };
    }

    case "support_csat_percent": {
      const s = b.supportCsatPercent;
      let tier: string;
      let comparisonText: string;
      if (value < s.concerningBelow) {
        tier = "concerning";
        comparisonText = `${value}% is below the ${s.concerningBelow}% concerning threshold`;
      } else if (value < s.averageBelow) {
        tier = "below_average";
        comparisonText = `${value}% is between ${s.concerningBelow}% and the ${s.averageBelow}% B2B SaaS average`;
      } else if (value < s.goodAtOrAbove) {
        tier = "average";
        comparisonText = `${value}% is at/above the ${s.averageBelow}% B2B SaaS average but below the ${s.goodAtOrAbove}% good threshold`;
      } else {
        tier = "good";
        comparisonText = `${value}% is at/above the ${s.goodAtOrAbove}% good threshold`;
      }
      return { metricKey, label: "Support CSAT", value, unit: "%", tier, comparisonText };
    }

    default:
      return null;
  }
}
