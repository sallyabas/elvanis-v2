import type { ComputedMetricComparison } from "./metrics";

/**
 * Financial lens reference thresholds — founder-set starting benchmarks for
 * the 20–200 employee B2B SaaS/tech-enabled SME ICP (UK/NL first).
 *
 * These are real published/experience-based figures, not generic filler —
 * but they are explicitly a starting point, not permanent. Refine once real
 * pilot audits (roadmap Phase 3) give actual cases to compare against. See
 * spec §4 Phase 1: lens prompts should "reference benchmarks from own
 * experience," not generic internet research.
 *
 * DB-backed as of 2026-08-06 (same "admin-adjustable, not a constant"
 * principle as pricing/app_settings) — see benchmarks-repository.ts for the
 * loader that reads the `lens_benchmarks` table and shapes it into
 * FinancialBenchmarks. This file now holds only: the type shape, the
 * DEFAULT constant (a safety fallback + the seed data's source of truth),
 * and pure functions that take a FinancialBenchmarks object as a parameter
 * rather than reading a module-level const — this is what makes
 * financial-benchmarks.test-cases.ts able to test the tier-boundary logic
 * directly with a fixture, no DB dependency.
 */
export interface FinancialBenchmarks {
  grossMarginPercent: {
    healthyMin: number;
    healthyMax: number;
    flagBelow: number;
    concerningBelow: number;
  };
  runwayMonths: {
    criticalBelow: number;
    warningBelow: number;
    healthyAtOrAbove: number;
  };
  customerConcentrationPercent: {
    healthyBelow: number;
    watchBelow: number;
    elevatedRiskBelow: number;
    criticalAtOrAbove: number;
  };
}

/** Fallback used if the DB read fails or returns incomplete data — also the seed data's own source of truth. */
export const DEFAULT_FINANCIAL_BENCHMARKS: FinancialBenchmarks = {
  grossMarginPercent: {
    healthyMin: 70, // 70–80% is the healthy range for this segment
    healthyMax: 80,
    flagBelow: 70,
    concerningBelow: 60,
  },
  runwayMonths: {
    criticalBelow: 6,
    warningBelow: 12,
    healthyAtOrAbove: 12,
  },
  customerConcentrationPercent: {
    healthyBelow: 10,
    watchBelow: 25,
    elevatedRiskBelow: 35,
    criticalAtOrAbove: 35,
  },
};

/** Rendered into the system prompt as general context/scale — not what decides any individual finding's tier. */
export function formatBenchmarksForPrompt(b: FinancialBenchmarks): string {
  return [
    `- Gross margin: below ${b.grossMarginPercent.flagBelow}% is worth flagging, below ${b.grossMarginPercent.concerningBelow}% is concerning (healthy range for this segment is ${b.grossMarginPercent.healthyMin}-${b.grossMarginPercent.healthyMax}%)`,
    `- Cash runway: below ${b.runwayMonths.criticalBelow} months is critical, ${b.runwayMonths.criticalBelow}-${b.runwayMonths.warningBelow} months is a warning, ${b.runwayMonths.healthyAtOrAbove}+ months is healthy`,
    `- Customer revenue concentration: under ${b.customerConcentrationPercent.healthyBelow}% is healthy, ${b.customerConcentrationPercent.healthyBelow}-${b.customerConcentrationPercent.watchBelow}% is a watch item, ${b.customerConcentrationPercent.watchBelow}-${b.customerConcentrationPercent.elevatedRiskBelow}% is elevated risk, ${b.customerConcentrationPercent.criticalAtOrAbove}%+ is critical`,
  ].join("\n");
}

export type FinancialMetricKey =
  | "gross_margin_percent"
  | "cash_runway_months"
  | "customer_concentration_percent";

/**
 * The actual >, <, tier-lookup comparison, done here in deterministic code —
 * never left to the LLM. Returns null for an unrecognized metricKey (the
 * lens then treats the value as qualitative evidence only, with no asserted
 * benchmark tier).
 */
export function compareFinancialMetric(b: FinancialBenchmarks, metricKey: string, value: number): ComputedMetricComparison | null {
  switch (metricKey as FinancialMetricKey) {
    case "gross_margin_percent": {
      let tier: string;
      let comparisonText: string;
      if (value < b.grossMarginPercent.concerningBelow) {
        tier = "concerning";
        comparisonText = `${value}% is below the ${b.grossMarginPercent.concerningBelow}% concerning threshold (healthy range is ${b.grossMarginPercent.healthyMin}-${b.grossMarginPercent.healthyMax}%)`;
      } else if (value < b.grossMarginPercent.flagBelow) {
        tier = "flag";
        comparisonText = `${value}% is below the healthy ${b.grossMarginPercent.healthyMin}-${b.grossMarginPercent.healthyMax}% range but at/above the ${b.grossMarginPercent.concerningBelow}% concerning threshold — worth flagging`;
      } else {
        tier = "healthy";
        comparisonText = `${value}% is at/above the healthy range floor of ${b.grossMarginPercent.healthyMin}%`;
      }
      return { metricKey, label: "Gross margin", value, unit: "%", tier, comparisonText };
    }

    case "cash_runway_months": {
      let tier: string;
      let comparisonText: string;
      if (value < b.runwayMonths.criticalBelow) {
        tier = "critical";
        comparisonText = `${value} months is below the ${b.runwayMonths.criticalBelow}-month critical threshold`;
      } else if (value < b.runwayMonths.warningBelow) {
        tier = "warning";
        comparisonText = `${value} months is between the ${b.runwayMonths.criticalBelow}-month critical and ${b.runwayMonths.warningBelow}-month healthy thresholds — a warning zone`;
      } else {
        tier = "healthy";
        comparisonText = `${value} months is at/above the ${b.runwayMonths.healthyAtOrAbove}-month healthy threshold`;
      }
      return { metricKey, label: "Cash runway", value, unit: "months", tier, comparisonText };
    }

    case "customer_concentration_percent": {
      const c = b.customerConcentrationPercent;
      let tier: string;
      let comparisonText: string;
      if (value < c.healthyBelow) {
        tier = "healthy";
        comparisonText = `${value}% is below the ${c.healthyBelow}% healthy threshold`;
      } else if (value < c.watchBelow) {
        tier = "watch";
        comparisonText = `${value}% is between the ${c.healthyBelow}% healthy and ${c.watchBelow}% watch thresholds`;
      } else if (value < c.elevatedRiskBelow) {
        tier = "elevated_risk";
        comparisonText = `${value}% is between the ${c.watchBelow}% watch and ${c.elevatedRiskBelow}% elevated-risk thresholds`;
      } else {
        tier = "critical";
        comparisonText = `${value}% is at/above the ${c.criticalAtOrAbove}% critical threshold`;
      }
      return { metricKey, label: "Customer revenue concentration", value, unit: "%", tier, comparisonText };
    }

    default:
      return null;
  }
}
