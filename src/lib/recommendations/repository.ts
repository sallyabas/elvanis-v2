import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_RECOMMENDATION_LIBRARY, type IssueTypeKey, type RecommendationLibraryEntry } from "./recommendation-library";
import type { LensType } from "@/lib/lenses/types";

/**
 * Server-only DB loader for recommendation_library (confirmed 2026-08-06,
 * closing the hardcoded-values audit's #2 finding). Same defensive-fallback
 * discipline as benchmarks-repository.ts — a DB hiccup here must never
 * break the reviewer workspace, so this falls back to
 * DEFAULT_RECOMMENDATION_LIBRARY on any read failure or incomplete row set.
 */

const KNOWN_KEYS: IssueTypeKey[] = [
  "no_financial_visibility",
  "customer_concentration",
  "thin_margin",
  "short_runway",
  "decision_latency",
  "meeting_overload",
  "no_operating_reporting",
  "low_feature_adoption",
  "high_churn",
  "weak_onboarding_activation",
  "pricing_pressure",
  "weak_differentiation",
  "recurring_lost_deal_pattern",
  "no_ai_governance_docs",
  "no_human_oversight",
  "unclear_ai_risk_classification",
];

function isKnownIssueTypeKey(key: string): key is IssueTypeKey {
  return (KNOWN_KEYS as string[]).includes(key);
}

interface RecommendationLibraryRow {
  issue_type_key: string;
  label: string;
  lens: string;
  keywords: string[];
  recommended_action_template: string;
  rationale: string;
  cascades_to: string[] | null;
}

export async function loadRecommendationLibrary(): Promise<RecommendationLibraryEntry[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("recommendation_library").select("*");
  if (error) {
    console.error(`recommendations/repository: failed to load recommendation_library, falling back to defaults: ${error.message}`);
    return DEFAULT_RECOMMENDATION_LIBRARY;
  }

  const rows = (data ?? []) as RecommendationLibraryRow[];
  const entries: RecommendationLibraryEntry[] = rows
    .filter((r) => isKnownIssueTypeKey(r.issue_type_key))
    .map((r) => ({
      key: r.issue_type_key as IssueTypeKey,
      label: r.label,
      lens: r.lens as LensType,
      keywords: r.keywords,
      recommendedActionTemplate: r.recommended_action_template,
      rationale: r.rationale,
      // Signal cascades (confirmed 2026-08-13) — filtered to known keys
      // rather than trusting the DB column wholesale, same defensive
      // pattern as isKnownIssueTypeKey above; a stale/typo'd cascade target
      // is silently dropped rather than corrupting cascade counting with an
      // unrecognized key.
      cascadesTo: (r.cascades_to ?? []).filter(isKnownIssueTypeKey),
    }));

  // Defensive: if the DB is missing rows, fall back to the full default set rather than running with a partial library.
  if (entries.length !== KNOWN_KEYS.length) {
    console.error(`recommendations/repository: recommendation_library returned ${entries.length}/${KNOWN_KEYS.length} recognized rows, falling back to defaults`);
    return DEFAULT_RECOMMENDATION_LIBRARY;
  }

  return entries;
}
