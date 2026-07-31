import { financialLens } from "./financial";
import { commercialLens } from "./commercial";
import { executionLens } from "./execution";
import { productLens } from "./product";
import type { LensModule, LensType } from "./types";

export type {
  LensType,
  ConfidenceLevel,
  EvidenceSufficiency,
  GoalRelevance,
  PrimaryGoal,
  GoalContext,
  CompanyProfileForLens,
  EvidenceFieldInput,
  FinancialImpact,
  LensFinding,
  LensDraftResult,
  LensDraftInput,
  LensModule,
} from "./types";
export type { MetricInput, ComputedMetricComparison } from "./metrics";
export { GOAL_LABELS, formatGoalContextForPrompt } from "./goals";
export { FINANCIAL_BENCHMARKS, compareFinancialMetric } from "./financial-benchmarks";
export type { FinancialMetricKey } from "./financial-benchmarks";
export { EXECUTION_BENCHMARKS, compareExecutionMetric } from "./execution-benchmarks";
export type { ExecutionMetricKey } from "./execution-benchmarks";

export { aiGovernanceLens } from "./ai-governance";
export type { AiGovernanceMode, AiGovernanceDraftInput, AiGovernanceDraftResult } from "./ai-governance";
export {
  GOVERNANCE_DIMENSIONS,
  computeOverallMaturity,
  scoreDimension,
} from "./ai-governance-framework";
export type { GovernanceDimensionKey, ComputedDimensionScore } from "./ai-governance-framework";

/**
 * Financial, Commercial, Execution, and Product share one pure evidence-in
 * shape (LensModule/LensDraftInput). AI & Governance does not — it branches
 * on mode and has its own input/output types (see ./ai-governance) — so
 * it's exported separately above rather than forced into this registry.
 */
export const lensRegistry: Record<Exclude<LensType, "ai_governance">, LensModule> = {
  financial: financialLens,
  commercial: commercialLens,
  execution: executionLens,
  product: productLens,
};
