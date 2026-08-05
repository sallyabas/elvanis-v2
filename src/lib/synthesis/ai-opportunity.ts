import { z } from "zod";
import { generateValidatedJson } from "@/lib/ai-client";
import { formatGoalContextForPrompt } from "@/lib/lenses/goals";
import type { OverallMaturityTier } from "@/lib/lenses/ai-governance-framework";
import type { CompanyProfileForLens, EvidenceSufficiency, GoalContext, LensType } from "@/lib/lenses/types";
import type { LensFindingWithSource } from "./conflict-detection";

/**
 * AI Opportunity Synthesis (spec §2.3 step 6): a separate pass reading all
 * five lenses' APPROVED findings (post-reviewer-approval, not raw drafts —
 * confirmed 2026-07-31; the spec's own step numbering lists this before the
 * reviewer gate, but synthesizing opportunities from findings that might
 * still get edited/rejected would be building on sand) plus a readiness
 * sub-check, tagging each opportunity "do_now" vs "fix_groundwork_first".
 *
 * Not a lens. Not owned by AI & Governance (confirmed when that lens was
 * built — it explicitly does not produce this output). Deliberately reuses
 * already-computed data instead of re-deriving it:
 * - `dataQuality` is computed deterministically from evidenceSufficiency
 *   across the 5 lenses — never re-judged by the LLM.
 * - `governanceFoundation` is computed deterministically from AI &
 *   Governance's own already-computed overall maturity tier — never
 *   re-derived here.
 * - `teamSkill` / `processMaturity` have no existing deterministic source,
 *   so the LLM classifies them (0-3, same rubric-classification pattern as
 *   AI & Governance's document-review mode — pick a tier, don't free-score).
 */

export interface ReadinessScores {
  dataQuality: number;
  teamSkill: number;
  processMaturity: number;
  governanceFoundation: number;
}

export type ReadinessStatus = "do_now" | "fix_groundwork_first";

export interface AiOpportunity {
  opportunityDescription: string;
  sourceFindingIds: string[];
  readinessStatus: ReadinessStatus;
  readinessReasoning: string;
}

export interface AiOpportunitySynthesisResult {
  readinessScores: ReadinessScores;
  opportunities: AiOpportunity[];
  notes?: string;
}

const GOVERNANCE_TIER_TO_SCORE: Record<OverallMaturityTier, number> = {
  nascent: 0,
  developing: 1,
  established: 2,
  mature: 3,
};

const SUFFICIENCY_POINTS: Record<EvidenceSufficiency, number> = {
  sufficient: 3,
  partial: 1.5,
  insufficient: 0,
};

function computeDataQualityScore(evidenceSufficiencyByLens: Partial<Record<LensType, EvidenceSufficiency>>): number {
  const values = Object.values(evidenceSufficiencyByLens) as EvidenceSufficiency[];
  if (values.length === 0) return 0;
  const avg = values.reduce((sum, v) => sum + SUFFICIENCY_POINTS[v], 0) / values.length;
  return Math.max(0, Math.min(3, Math.round(avg)));
}

function computeGovernanceFoundationScore(tier: OverallMaturityTier | null): number {
  return tier ? GOVERNANCE_TIER_TO_SCORE[tier] : 0;
}

const READINESS_RUBRIC = `0 = no visibility/informal only, 1 = ad hoc, 2 = partial/developing, 3 = established and documented`;

const SYSTEM_PROMPT = `You are the AI Opportunity Synthesis step of an AI execution audit for founder-led B2B SaaS and tech-enabled SMEs (20-200 employees, UK/NL first). You read the FINAL, reviewer-approved findings from all five lenses (Financial, Commercial/Market, Execution/Operating, Product/Customer, AI & Governance) and identify concrete AI/automation opportunities they collectively point toward, each gated by whether the company is actually ready for it.

HARD RULES:
1. Never fabricate an opportunity not grounded in the submitted findings. Every opportunity must cite the specific "sourceFindingIds" it was derived from — never invent a finding ID that isn't in the list you were given.
2. Classify "teamSkillScore" and "processMaturityScore" using the rubric below (0-3) — this is a classification task (pick the integer whose description best matches what the findings show), not free-form scoring. If findings don't give you enough signal for one of these, score conservatively (0 or 1) and say so in the reasoning rather than assuming maturity you have no evidence for.
   Rubric: ${READINESS_RUBRIC}
3. For each opportunity, tag "readinessStatus": "do_now" only if the underlying data/process/governance foundation shown in the findings and readiness scores can actually support it safely today. Use "fix_groundwork_first" whenever a low data_quality, team_skill, process_maturity, or governance_foundation score would make jumping straight to this opportunity risky — say which readiness dimension is the blocker in "readinessReasoning".
4. Do not recommend anything that requires ignoring or contradicting an approved finding. If findings conflict with each other, that should already have been resolved before you see this data — treat what you're given as settled fact.
5. If the approved findings don't support any genuine AI/automation opportunity, return an empty "opportunities" array — do not manufacture one.
6. Output strict JSON matching the schema below. No prose outside the JSON.

OUTPUT SCHEMA (JSON object):
{
  "teamSkillScore": number,       // 0-3, see rubric
  "teamSkillReasoning": string,
  "processMaturityScore": number, // 0-3, see rubric
  "processMaturityReasoning": string,
  "opportunities": [
    {
      "opportunityDescription": string,
      "sourceFindingIds": string[],
      "readinessStatus": "do_now" | "fix_groundwork_first",
      "readinessReasoning": string
    }
  ],
  "notes": string
}`;

const aiOpportunityOutputSchema = z.object({
  teamSkillScore: z.number(),
  teamSkillReasoning: z.string(),
  processMaturityScore: z.number(),
  processMaturityReasoning: z.string(),
  opportunities: z.array(
    z.object({
      opportunityDescription: z.string(),
      sourceFindingIds: z.array(z.string()),
      readinessStatus: z.enum(["do_now", "fix_groundwork_first"]),
      readinessReasoning: z.string(),
    }),
  ),
  notes: z.string().optional(),
});

function formatFindingsForPrompt(findings: LensFindingWithSource[]): string {
  if (findings.length === 0) return "(no approved findings — do not manufacture opportunities from nothing)";
  return findings
    .map(
      ({ lens, finding }) =>
        `[${finding.findingId}] (${lens}, confidence: ${finding.confidenceLevel}) ${finding.title} — ${finding.rootCause}`,
    )
    .join("\n");
}

export async function synthesizeAiOpportunities(
  approvedFindings: LensFindingWithSource[],
  evidenceSufficiencyByLens: Partial<Record<LensType, EvidenceSufficiency>>,
  governanceMaturityTier: OverallMaturityTier | null,
  company: CompanyProfileForLens,
  goal: GoalContext,
): Promise<AiOpportunitySynthesisResult> {
  const dataQuality = computeDataQualityScore(evidenceSufficiencyByLens);
  const governanceFoundation = computeGovernanceFoundationScore(governanceMaturityTier);

  const validIds = new Set(approvedFindings.map((f) => f.finding.findingId));

  const userPrompt = `COMPANY PROFILE:
Name: ${company.name}
Industry: ${company.industry ?? "unknown"}
Business model: ${company.businessModel ?? "unknown"}
Employee count: ${company.employeeCount ?? "unknown"}
Stage: ${company.stage ?? "unknown"}

GOAL CONTEXT:
${formatGoalContextForPrompt(goal)}

COMPUTED READINESS SCORES (already calculated, final — do not recompute):
- data_quality: ${dataQuality}/3 (from evidence sufficiency across all lenses)
- governance_foundation: ${governanceFoundation}/3 (from AI & Governance lens's own computed maturity: ${governanceMaturityTier ?? "not assessed"})
- team_skill: you classify this, see rule 2
- process_maturity: you classify this, see rule 2

APPROVED FINDINGS FROM ALL FIVE LENSES:
${formatFindingsForPrompt(approvedFindings)}

Produce your readiness classification and opportunities now, following the output schema exactly.`;

  const raw = await generateValidatedJson(aiOpportunityOutputSchema, {
    schemaName: "ai-opportunity-synthesis",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
  });

  const opportunities: AiOpportunity[] = raw.opportunities
    .map((o) => ({
      ...o,
      sourceFindingIds: o.sourceFindingIds.filter((id) => validIds.has(id)),
    }))
    .filter((o) => o.sourceFindingIds.length > 0);

  return {
    readinessScores: {
      dataQuality,
      teamSkill: Math.max(0, Math.min(3, Math.round(raw.teamSkillScore))),
      processMaturity: Math.max(0, Math.min(3, Math.round(raw.processMaturityScore))),
      governanceFoundation,
    },
    opportunities,
    notes: raw.notes,
  };
}
