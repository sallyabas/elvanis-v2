import { financialLens } from "./financial";
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
  FindingOrigin,
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

export { commercialLens } from "./commercial";
export type { CommercialSelfReport, CommercialDraftInput, CommercialDraftResult } from "./commercial";
export { runCompetitorResearch } from "./commercial-research";
export type { IndependentResearchFinding } from "./commercial-research";

/**
 * Financial, Execution, and Product share one pure evidence-in shape
 * (LensModule/LensDraftInput). AI & Governance and Commercial do not — both
 * branch/hybridize and have their own input/output types (see
 * ./ai-governance and ./commercial) — so they're exported separately above
 * rather than forced into this registry.
 */
export const lensRegistry: Record<Exclude<LensType, "ai_governance" | "commercial">, LensModule> = {
  financial: financialLens,
  execution: executionLens,
  product: productLens,
};
