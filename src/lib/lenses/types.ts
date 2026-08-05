// Shared shape for the five-lens engine. Matches the `lens_type` enum and
// `lens_findings` table in supabase/migrations — see spec §3, §4 Phase 1.

import type { MetricInput } from "./metrics";

export type LensType =
  | "financial"
  | "commercial"
  | "execution"
  | "product"
  | "ai_governance";

export type ConfidenceLevel = "high" | "medium" | "low" | "insufficient";
export type EvidenceSufficiency = "sufficient" | "partial" | "insufficient";
/**
 * How a finding bears on the client's stated goal. "directly_supports" added
 * 2026-08-01 after live testing showed the model reliably hallucinating an
 * out-of-enum value ("directly_affects") for genuinely healthy/positive
 * findings under a directly-relevant goal (e.g. gross margin comfortably
 * above benchmark, under a cash-flow-efficiency goal) — none of the original
 * three values honestly fit "this is good news and directly relevant," so
 * the model invented one instead of picking the closest existing option.
 * The schema was incomplete for a real, common case, not a prompt-wording
 * problem — this is the fix; prompt guidance is reinforcement on top of it,
 * not a substitute for it.
 *
 * "directly_affects" added 2026-08-05, same root cause, a second real gap —
 * the `directly_supports` fix did not stop the hallucination; a real
 * end-to-end run (2026-08-04, Priority 1 verification) reproduced the exact
 * same invalid value from Execution/Product/Commercial under a
 * `cash_flow_margin_efficiency` goal. Traced to each lens's own
 * GOAL-RELEVANCE GUIDANCE for that specific goal: Execution's is "labor-hours
 * cost of decision latency and meeting load," Product's is "whether low
 * adoption/high churn is wasting acquisition spend," Commercial's is
 * "pricing pressure forcing discounting, margin-eroding competitive
 * dynamics" — all three describe a genuinely DIRECT, material, and often
 * quantifiable cost/impact channel into the goal that is nonetheless NOT the
 * primary obstruction of it. Neither existing negative value honestly fits:
 * "directly_blocks" overstates it (nothing is actually preventing the goal),
 * "indirectly_affects" understates it (the cost link is direct and traceable,
 * not tangential). Reproduced live: identical evidence at this exact
 * boundary made the model swing unpredictably between `indirectly_affects`
 * and `directly_blocks` across repeated runs (both defensible-sounding but
 * wrong, unlike a clean pick) — the same instability signature that
 * originally motivated `directly_supports`, this time on the negative side.
 * Reusing the model's own repeatedly-chosen name ("directly_affects") rather
 * than inventing a new one, since it's already the intuitive fit and now
 * matches what every prompt asks for.
 */
export type GoalRelevance = "directly_blocks" | "directly_affects" | "directly_supports" | "indirectly_affects" | "unrelated";
/**
 * Business-impact severity if this finding goes unaddressed — deliberately
 * independent of confidenceLevel (how sure we are) and of report-level
 * priority_ranking (which combines goal/financial/urgency/confidence scores
 * for top-3 SELECTION). A finding can be low-confidence AND critical
 * severity (e.g. a plausible but unverified compliance exposure), or
 * high-confidence AND low severity — these are genuinely different axes,
 * confirmed 2026-08-01.
 */
export type Severity = "critical" | "high" | "medium" | "low";

/**
 * The goal menu (Phase 0 roadmap item, locked 2026-07-31). Goal is a
 * weighting layer read by every lens, not a lens itself — see spec §2.3
 * step 1. No separate AI/Tender Readiness goal: that's the Tender Readiness
 * module's own entry point, not a core-audit goal.
 */
export type PrimaryGoal =
  | "cash_flow_margin_efficiency"
  | "growth_revenue_efficiency"
  | "churn_retention"
  | "execution_speed"
  | "product_delivery";

export interface GoalContext {
  primaryGoal: PrimaryGoal;
  secondaryGoal?: PrimaryGoal | null;
  urgencyLevel?: string | null;
  targetMetric?: string | null;
  timeHorizon?: string | null;
  successDefinition?: string | null;
  /**
   * Client's own words on "what would good look like" for this goal (spec
   * §1.9a, confirmed 2026-08-02) — always client-authored, optional, never
   * fed into lens prompts (deliberately out of scope; see §1.9a "worth
   * considering later"). Shown alongside the benchmark comparison in the
   * final report — a neutral note is shown in its place when blank, never
   * silently omitted.
   */
  desiredFutureStatePrimary?: string | null;
  desiredFutureStateSecondary?: string | null;
}

/**
 * Mirrors the subset of `companies` every lens prompt reads — see spec §2.1.
 * `country` was split into two independent jurisdiction signals (see
 * supabase/migrations/20260731180513_split_company_jurisdiction.sql):
 * registration location (drives UAE DIFC/ADGM-style rules) vs. customer
 * market location (drives extraterritorial regimes like EU AI Act/GDPR/
 * Saudi PDPL). `uaeFreeZone` isn't included here — that level of detail is
 * for the Tender Readiness/Data Protection Compliance modules' own
 * jurisdiction checks, not the core five lenses' business diagnostics.
 */
export interface CompanyProfileForLens {
  name: string;
  industry: string | null;
  businessModel: "B2B" | "B2C" | null;
  registrationCountry: string | null;
  customerMarketCountries: string[];
  employeeCount: number | null;
  stage: string | null;
  revenueRangeBand: string | null;
  customerType: string | null;
  mainToolsStack: Record<string, unknown> | null;
  teamStructureSummary: string | null;
}

/** Mirrors `evidence_fields` for the lens being run. */
export interface EvidenceFieldInput {
  fieldName: string;
  fieldValue: string | null;
  source: "parsed" | "manual";
  isBlank: boolean;
}

export interface FinancialImpact {
  impactBandLow: number | null;
  impactBandHigh: number | null;
  currency: string;
  confidenceLevel: ConfidenceLevel;
  /** Required whenever a band is given — never a fake-precise single number (spec §2.3 step 7). */
  assumptions: string[];
}

/** Client-facing source tag (spec §2.3a, confirmed 2026-07-31) — currently used by Commercial/Market. */
export type FindingOrigin = "client_reported" | "ai_independent";

/**
 * Confirmed 2026-08-01: four fields must stay explicitly separate, not
 * folded into free text — root cause and recommended fix have been the
 * core value proposition from day one, not optional detail.
 */
export interface LensFinding {
  findingId: string;
  /** Short label for lists/headers, e.g. "Revenue concentrated in 2 clients (61% of ARR)". */
  title: string;
  /** (1) The observation itself — what was actually found, in full, including any factual benchmark comparison. Distinct from the short title. */
  diagnosis: string;
  /** (2) WHY — the underlying mechanism. Must not just restate the diagnosis or a benchmark comparison; that belongs in diagnosis, not here. */
  rootCause: string;
  /** (3) The recommended fix/action — concrete and grounded in the finding, never fabricated beyond what the evidence reasonably supports. */
  recommendedAction: string;
  /** (4) Business-impact severity if unaddressed — see Severity docblock. Independent of confidenceLevel and of report-level priority_ranking. */
  severity: Severity;
  /** Specific evidence field names/values this finding is grounded in — never fabricated. */
  evidenceCited: string[];
  goalRelevance: GoalRelevance;
  /** Null when a finding isn't financially quantifiable. */
  financialImpact: FinancialImpact | null;
  confidenceLevel: ConfidenceLevel;
  isMissingDataFinding: boolean;
  /** Undefined for lenses where the client-reported-vs-AI-found distinction doesn't apply. */
  origin?: FindingOrigin;
}

export interface LensDraftResult {
  lens: LensType;
  findings: LensFinding[];
  evidenceSufficiency: EvidenceSufficiency;
  notes?: string;
}

export interface LensDraftInput {
  company: CompanyProfileForLens;
  goal: GoalContext;
  /** Free-text/qualitative evidence — narrative context, missing-data signal, evidence citations. */
  evidenceFields: EvidenceFieldInput[];
  /** Typed numeric evidence for anything benchmark-comparable — see ./metrics. Comparison against a benchmark is computed in code, never left to the LLM. */
  metrics: MetricInput[];
}

/**
 * Each lens is an independent AI call with its own prompt + output schema —
 * one lens failing must never block the others (see spec §2.1).
 */
export interface LensModule {
  lens: LensType;
  runDraft: (input: LensDraftInput) => Promise<LensDraftResult>;
}
