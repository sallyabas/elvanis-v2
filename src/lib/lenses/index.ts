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
export { DEFAULT_FINANCIAL_BENCHMARKS, compareFinancialMetric } from "./financial-benchmarks";
export type { FinancialBenchmarks, FinancialMetricKey } from "./financial-benchmarks";
export { DEFAULT_EXECUTION_BENCHMARKS, compareExecutionMetric } from "./execution-benchmarks";
export type { ExecutionBenchmarks, ExecutionMetricKey } from "./execution-benchmarks";
export { DEFAULT_PRODUCT_BENCHMARKS, compareProductMetric } from "./product-benchmarks";
export type { ProductBenchmarks, ProductMetricKey } from "./product-benchmarks";
export {
  loadFinancialBenchmarks,
  loadExecutionBenchmarks,
  loadProductBenchmarks,
  loadGovernanceDimensions,
  loadGovernanceMaturityTierBoundaries,
} from "./benchmarks-repository";

export { aiGovernanceLens } from "./ai-governance";
export type { AiGovernanceMode, AiGovernanceDraftInput, AiGovernanceDraftResult } from "./ai-governance";
export {
  DEFAULT_GOVERNANCE_DIMENSIONS,
  GOVERNANCE_DIMENSION_KEYS,
  computeOverallMaturity,
  scoreDimension,
} from "./ai-governance-framework";
export type {
  GovernanceDimensionKey,
  GovernanceDimensionDefinition,
  ComputedDimensionScore,
  GovernanceMaturityTierBoundaries,
} from "./ai-governance-framework";

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
