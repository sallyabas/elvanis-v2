import type { ComputedMetricComparison } from "./metrics";

/**
 * Execution/Operating lens reference thresholds — externally published
 * benchmarks (2025/2026 industry reports), pulled because the founder has
 * no first-hand thresholds memorized for this domain the way she does for
 * Financial. Explicitly a starting point, not permanent — refine with real
 * pilot audits (roadmap Phase 3) once actual cases exist to compare against.
 * Every figure below is sourced; do not add a number here without a citation.
 *
 * DB-backed as of 2026-08-06 (same rationale as financial-benchmarks.ts) —
 * see benchmarks-repository.ts for the loader. This file holds only the
 * type shape, the DEFAULT constant (fallback + seed source of truth), and
 * pure functions taking an ExecutionBenchmarks parameter instead of reading
 * a module-level const.
 */
export interface ExecutionBenchmarks {
  deliveryLeadTimeForChangesDays: {
    topPercentileUnderDays: number;
    highPercentileUnderDays: number;
    source: string;
  };
  prCycleTimeHours: {
    eliteBelow: number;
    goodRange: readonly [number, number];
    fairRange: readonly [number, number];
    poorAbove: number;
    source: string;
  };
  prReviewPickupTimeHours: {
    eliteBelow: number;
    industryAverageHours: number;
    note: string;
    source: string;
  };
  decisionApprovalLatencyHours: {
    warningAtHours: number;
    crisisAtHours: number;
    delayShareFromDecisionLatency: string;
    revenueAtRisk: string;
    source: string;
  };
  meetingLoadHoursPerWeek: {
    companyWideAverage: readonly [number, number];
    individualContributorAverage: number;
    managerRange: readonly [number, number];
    cSuiteAverage: number;
    source: string;
  };
}

/** Fallback used if the DB read fails or returns incomplete data — also the seed data's own source of truth. */
export const DEFAULT_EXECUTION_BENCHMARKS: ExecutionBenchmarks = {
  // DORA (dora.dev) 2025 report: moved from 4-tier Elite/High/Medium/Low to
  // percentile distribution. Only meaningful when engineering delivery
  // evidence (commit-to-prod data) is actually submitted.
  deliveryLeadTimeForChangesDays: {
    topPercentileUnderDays: 1, // top ~15% of teams
    highPercentileUnderDays: 7, // next ~15-30% of teams
    // >7 days is the majority case (43.5% of teams) — not an outlier
    source: "DORA, dora.dev 2025 State of DevOps report",
  },
  // LinearB 2026 Software Engineering Benchmarks Report (8.1M+ PRs, 4,800 orgs).
  prCycleTimeHours: {
    eliteBelow: 25,
    goodRange: [25, 72],
    fairRange: [73, 161],
    poorAbove: 161,
    source: "LinearB 2026 Software Engineering Benchmarks Report",
  },
  prReviewPickupTimeHours: {
    eliteBelow: 7,
    industryAverageHours: 105.6, // 4.4 days
    note: "a third of all PRs spend 78% of their lifecycle sitting idle, not in active review",
    source: "LinearB 2026 Software Engineering Benchmarks Report",
  },
  // Broader than engineering — applies to any approval/sign-off chain
  // (finance, legal, procurement, exec sign-off), not just code review.
  decisionApprovalLatencyHours: {
    warningAtHours: 48,
    crisisAtHours: 168, // 7 days
    delayShareFromDecisionLatency: "60% of corporate project delays trace back to decision latency, not execution capacity itself",
    revenueAtRisk: "~3 in 4 leaders estimate up to 5% of annual revenue lost to slow decision-making/delayed execution",
    source: "Agile IG (\"Decision Latency\" analysis); West Monroe 2026 \"Speed Wins\" survey (214 C-suite + 1,000 managers, $250M+ revenue US companies)",
  },
  // Aggregate workplace survey data — company-wide average as the anchor,
  // with role-based variance so a single number isn't misapplied.
  meetingLoadHoursPerWeek: {
    companyWideAverage: [11, 12],
    individualContributorAverage: 4,
    managerRange: [9, 13],
    cSuiteAverage: 11,
    source: "Aggregated 2025/2026 workplace meeting-time survey data (Fellow, Hubstaff, Chanty)",
  },
};

/** Rendered into the system prompt as general context/scale — not what decides any individual finding's tier. */
export function formatExecutionBenchmarksForPrompt(b: ExecutionBenchmarks): string {
  return [
    `- Delivery lead time for changes (commit to production, only when engineering delivery evidence is submitted): top ~15% of teams under ${b.deliveryLeadTimeForChangesDays.topPercentileUnderDays} day, next ~15-30% under ${b.deliveryLeadTimeForChangesDays.highPercentileUnderDays} days, 43.5% of teams over ${b.deliveryLeadTimeForChangesDays.highPercentileUnderDays} days (the median case, not an outlier) [source: ${b.deliveryLeadTimeForChangesDays.source}]`,
    `- PR/code review cycle time: elite <${b.prCycleTimeHours.eliteBelow}h, good ${b.prCycleTimeHours.goodRange[0]}-${b.prCycleTimeHours.goodRange[1]}h, fair ${b.prCycleTimeHours.fairRange[0]}-${b.prCycleTimeHours.fairRange[1]}h, poor >${b.prCycleTimeHours.poorAbove}h [source: ${b.prCycleTimeHours.source}]`,
    `- PR review pickup time: elite <${b.prReviewPickupTimeHours.eliteBelow}h, industry average ${b.prReviewPickupTimeHours.industryAverageHours}h (4.4 days); note ${b.prReviewPickupTimeHours.note} [source: ${b.prReviewPickupTimeHours.source}]`,
    `- Decision/approval latency (any approval chain, not just engineering): ${b.decisionApprovalLatencyHours.delayShareFromDecisionLatency}; ${b.decisionApprovalLatencyHours.revenueAtRisk}; SME/approver response time over ${b.decisionApprovalLatencyHours.warningAtHours}h is a warning sign, over ${b.decisionApprovalLatencyHours.crisisAtHours}h (7 days) is a crisis [source: ${b.decisionApprovalLatencyHours.source}]`,
    `- Meeting load: company-wide average ${b.meetingLoadHoursPerWeek.companyWideAverage[0]}-${b.meetingLoadHoursPerWeek.companyWideAverage[1]}h/week, individual contributors ~${b.meetingLoadHoursPerWeek.individualContributorAverage}h/week, managers ${b.meetingLoadHoursPerWeek.managerRange[0]}-${b.meetingLoadHoursPerWeek.managerRange[1]}h/week, C-suite ~${b.meetingLoadHoursPerWeek.cSuiteAverage}h/week — use role mix from team structure, not one flat number [source: ${b.meetingLoadHoursPerWeek.source}]`,
  ].join("\n");
}

export type ExecutionMetricKey =
  | "delivery_lead_time_for_changes_days"
  | "pr_cycle_time_hours"
  | "pr_review_pickup_time_hours"
  | "decision_approval_latency_hours"
  | "weekly_meeting_hours_per_manager";

/**
 * The actual >, <, tier-lookup comparison, done here in deterministic code —
 * never left to the LLM. Returns null for an unrecognized metricKey (the
 * lens then treats the value as qualitative evidence only, with no asserted
 * benchmark tier).
 */
export function compareExecutionMetric(b: ExecutionBenchmarks, metricKey: string, value: number): ComputedMetricComparison | null {
  switch (metricKey as ExecutionMetricKey) {
    case "delivery_lead_time_for_changes_days": {
      const d = b.deliveryLeadTimeForChangesDays;
      let tier: string;
      let comparisonText: string;
      if (value < d.topPercentileUnderDays) {
        tier = "top_percentile";
        comparisonText = `${value} days is under the ${d.topPercentileUnderDays}-day top-~15%-of-teams threshold`;
      } else if (value <= d.highPercentileUnderDays) {
        tier = "high_percentile";
        comparisonText = `${value} days is at/under the ${d.highPercentileUnderDays}-day threshold for the next ~15-30% of teams`;
      } else {
        tier = "below_median";
        comparisonText = `${value} days is over the ${d.highPercentileUnderDays}-day mark — in the 43.5% majority-of-teams band, not an outlier`;
      }
      return { metricKey, label: "Delivery lead time for changes", value, unit: "days", tier, comparisonText };
    }

    case "pr_cycle_time_hours": {
      const p = b.prCycleTimeHours;
      let tier: string;
      let comparisonText: string;
      if (value < p.eliteBelow) {
        tier = "elite";
        comparisonText = `${value}h is under the ${p.eliteBelow}h elite threshold`;
      } else if (value <= p.goodRange[1]) {
        tier = "good";
        comparisonText = `${value}h is within the ${p.goodRange[0]}-${p.goodRange[1]}h "good" range`;
      } else if (value <= p.fairRange[1]) {
        tier = "fair";
        comparisonText = `${value}h is within the ${p.fairRange[0]}-${p.fairRange[1]}h "fair" range`;
      } else {
        tier = "poor";
        comparisonText = `${value}h is over the ${p.poorAbove}h "poor" threshold`;
      }
      return { metricKey, label: "PR cycle time", value, unit: "hours", tier, comparisonText };
    }

    case "pr_review_pickup_time_hours": {
      const r = b.prReviewPickupTimeHours;
      let tier: string;
      let comparisonText: string;
      if (value < r.eliteBelow) {
        tier = "elite";
        comparisonText = `${value}h is under the ${r.eliteBelow}h elite threshold`;
      } else if (value < r.industryAverageHours) {
        tier = "better_than_average";
        comparisonText = `${value}h is faster than the ${r.industryAverageHours}h (4.4-day) industry average, though above the ${r.eliteBelow}h elite threshold`;
      } else {
        tier = "worse_than_average";
        comparisonText = `${value}h is slower than the ${r.industryAverageHours}h (4.4-day) industry average`;
      }
      return { metricKey, label: "PR review pickup time", value, unit: "hours", tier, comparisonText };
    }

    case "decision_approval_latency_hours": {
      const d = b.decisionApprovalLatencyHours;
      let tier: string;
      let comparisonText: string;
      if (value <= d.warningAtHours) {
        tier = "acceptable";
        comparisonText = `${value}h is at/under the ${d.warningAtHours}h warning threshold`;
      } else if (value <= d.crisisAtHours) {
        tier = "warning";
        comparisonText = `${value}h is between the ${d.warningAtHours}h warning and ${d.crisisAtHours}h (7-day) crisis thresholds`;
      } else {
        tier = "crisis";
        comparisonText = `${value}h is over the ${d.crisisAtHours}h (7-day) crisis threshold`;
      }
      return { metricKey, label: "Decision/approval latency", value, unit: "hours", tier, comparisonText };
    }

    case "weekly_meeting_hours_per_manager": {
      const m = b.meetingLoadHoursPerWeek;
      let tier: string;
      let comparisonText: string;
      if (value < m.managerRange[0]) {
        tier = "below_average";
        comparisonText = `${value}h/week is below the typical manager range of ${m.managerRange[0]}-${m.managerRange[1]}h/week`;
      } else if (value <= m.managerRange[1]) {
        tier = "typical";
        comparisonText = `${value}h/week is within the typical manager range of ${m.managerRange[0]}-${m.managerRange[1]}h/week`;
      } else {
        tier = "above_average";
        comparisonText = `${value}h/week is above the typical manager range of ${m.managerRange[0]}-${m.managerRange[1]}h/week`;
      }
      return { metricKey, label: "Weekly meeting hours per manager", value, unit: "hours/week", tier, comparisonText };
    }

    default:
      return null;
  }
}
