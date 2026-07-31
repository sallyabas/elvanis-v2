// Shared shape for the five-lens engine. Matches the `lens_type` enum and
// `lens_findings` table in supabase/migrations — see spec §3, §4 Phase 1.

export type LensType =
  | "financial"
  | "commercial"
  | "execution"
  | "product"
  | "ai_governance";

export type ConfidenceLevel = "high" | "medium" | "low" | "insufficient";

export interface LensFindingDraft {
  lens: LensType;
  summary: string;
  rootCause: string;
  confidenceLevel: ConfidenceLevel;
  isMissingDataFinding: boolean;
}

/**
 * Each lens is an independent AI call with its own prompt + output schema —
 * one lens failing must never block the others (see spec §2.1). Prompts
 * themselves are Phase 1 work (roadmap §4) and not yet written.
 */
export interface LensModule {
  lens: LensType;
  runDraft: (companyId: string) => Promise<LensFindingDraft>;
}
