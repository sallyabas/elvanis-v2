/**
 * AI & Governance lens reference framework — externally published sources,
 * synthesized into a 7-dimension maturity rubric sized for a 20-200
 * employee SME (not an enterprise AI compliance program). Explicitly a
 * starting point, not permanent — refine once real pilot audits give actual
 * cases to compare against. Every dimension is sourced; do not add one
 * without a citation.
 *
 * Sources:
 * - EU AI Act (in force; high-risk Annex III deadline deferred to
 *   2026-12-02 under the Digital Omnibus as of this writing) — 4-tier risk
 *   classification (unacceptable/high/limited/minimal), Art. 14 human
 *   oversight requirement for high-risk systems.
 * - NIST AI Risk Management Framework (AI RMF 1.0) — 4 core functions:
 *   Govern, Map, Measure, Manage.
 * - ISO/IEC 42001:2023 — AI management system clauses on risk assessment,
 *   AI system impact assessment, data governance, third-party/supplier
 *   oversight.
 * - OECD AI Principles — accountability, transparency, human oversight,
 *   robustness/safety.
 *
 * Boundary: this rubric assesses whether the company has ANY governance
 * awareness/process in place — a maturity signal, not a formal EU AI Act
 * conformity assessment or legal risk classification. Deep AI Act
 * risk-classification work is the Tender Readiness module's job (spec
 * §1.7 correction note 2), built later, standalone. Don't duplicate it here.
 */

export type GovernanceDimensionKey =
  | "ai_use_inventory"
  | "risk_classification_awareness"
  | "human_oversight"
  | "data_governance_for_ai"
  | "vendor_model_risk_management"
  | "incident_response_monitoring"
  | "governance_ownership";

export interface GovernanceDimensionDefinition {
  key: GovernanceDimensionKey;
  label: string;
  source: string;
  /** Maturity level descriptions, index 0-3 (absent/informal/partial/established). */
  levels: [string, string, string, string];
}

export const GOVERNANCE_DIMENSIONS: GovernanceDimensionDefinition[] = [
  {
    key: "ai_use_inventory",
    label: "AI use inventory",
    source: "NIST AI RMF (Map function); ISO/IEC 42001 (context/scope, Clause 4)",
    levels: [
      "No inventory — unsure what AI is used across the business",
      "Informal awareness only (leadership knows roughly, nothing documented)",
      "Partial documented inventory (some tools/uses listed, not comprehensive)",
      "Complete documented inventory, maintained and reviewed periodically",
    ],
  },
  {
    key: "risk_classification_awareness",
    label: "Risk classification awareness",
    source: "EU AI Act 4-tier risk classification; NIST AI RMF (Measure function)",
    levels: [
      "No risk assessment of any AI use",
      "Awareness that risk varies by use case, but no structured assessment",
      "Informal risk assessment for some/most AI uses",
      "Formal risk classification against a recognized framework (e.g. EU AI Act tiers) for all AI uses",
    ],
  },
  {
    key: "human_oversight",
    label: "Human oversight",
    source: "EU AI Act Art. 14 (human oversight for high-risk systems); NIST AI RMF (Manage function)",
    levels: [
      "No human review of AI-generated outputs",
      "Ad hoc/inconsistent review",
      "Human review required for some AI uses/outputs",
      "Documented human-in-the-loop process required for all consequential AI outputs",
    ],
  },
  {
    key: "data_governance_for_ai",
    label: "Data governance for AI",
    source: "ISO/IEC 42001 data management provisions — the AI-specific angle only, not full GDPR compliance (that's the separate Data Protection Compliance module's job)",
    levels: [
      "No visibility into what data feeds AI tools",
      "Some awareness, not documented",
      "Documented for some AI tools/uses",
      "Documented and reviewed for all AI tools/uses",
    ],
  },
  {
    key: "vendor_model_risk_management",
    label: "Vendor/model risk management",
    source: "NIST AI RMF (third-party risk); ISO/IEC 42001 (supplier oversight)",
    levels: [
      "No vendor risk review of any third-party AI tool/API used",
      "Informal awareness only",
      "Reviewed for some vendors/tools",
      "Documented vendor risk review process for all AI vendors",
    ],
  },
  {
    key: "incident_response_monitoring",
    label: "Incident response & monitoring",
    source: "NIST AI RMF (Manage function); ISO/IEC 42001 (performance evaluation, Clause 9)",
    levels: [
      "No monitoring or incident response process for AI failures",
      "Informal only (\"we'd notice and fix it\")",
      "Some monitoring/process in place for some AI uses",
      "Documented monitoring + incident response process",
    ],
  },
  {
    key: "governance_ownership",
    label: "Governance ownership",
    source: "ISO/IEC 42001 (leadership/roles, Clause 5); OECD AI Principles (accountability)",
    levels: [
      "No one specifically responsible for AI governance",
      "Informally someone's job (e.g. \"the CTO handles it\"), not formalized",
      "Named owner, not formalized in writing",
      "Formally assigned AI governance responsibility with documented scope",
    ],
  },
];

export interface ComputedDimensionScore {
  key: GovernanceDimensionKey;
  label: string;
  score: number; // 0-3
  levelDescription: string;
  source: string;
}

/** Looks up the level description for a given dimension + score — pure lookup, no LLM judgment. */
export function scoreDimension(key: GovernanceDimensionKey, score: number): ComputedDimensionScore | null {
  const def = GOVERNANCE_DIMENSIONS.find((d) => d.key === key);
  if (!def) return null;
  const clamped = Math.max(0, Math.min(3, Math.round(score)));
  return {
    key,
    label: def.label,
    score: clamped,
    levelDescription: def.levels[clamped],
    source: def.source,
  };
}

export type OverallMaturityTier = "nascent" | "developing" | "established" | "mature";

/** Deterministic aggregation across all scored dimensions — never left to the LLM. */
export function computeOverallMaturity(scores: ComputedDimensionScore[]): {
  totalScore: number;
  maxPossible: number;
  tier: OverallMaturityTier;
  comparisonText: string;
} {
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  const maxPossible = GOVERNANCE_DIMENSIONS.length * 3;

  let tier: OverallMaturityTier;
  if (totalScore <= 6) tier = "nascent";
  else if (totalScore <= 13) tier = "developing";
  else if (totalScore <= 18) tier = "established";
  else tier = "mature";

  return {
    totalScore,
    maxPossible,
    tier,
    comparisonText: `${totalScore}/${maxPossible} total maturity points — "${tier}" tier (0-6 nascent, 7-13 developing, 14-18 established, 19-21 mature)`,
  };
}

export function formatDimensionScoresForPrompt(scores: ComputedDimensionScore[]): string {
  if (scores.length === 0) {
    return "(no dimension scores provided — questionnaire mode requires at least one)";
  }
  return scores
    .map((s) => `- [${s.key}] ${s.label}: ${s.score}/3 — "${s.levelDescription}" [source: ${s.source}]`)
    .join("\n");
}
