import { z } from "zod";
import { requestSecondOpinionCompletion } from "@/lib/second-opinion-client";
import { formatGoalContextForPrompt } from "@/lib/lenses/goals";
import { GOAL_RELEVANCE_WEIGHTS, CONFIDENCE_WEIGHTS, GOAL_RELEVANCE_DEFINITIONS, FIX_FIRST_CRITERIA_DESCRIPTION } from "@/lib/reports/ranking-rubric";
import type { GoalContext, LensFinding } from "@/lib/lenses/types";

/**
 * Reviewer report-level "second opinion" (confirmed 2026-09-04) — a real,
 * separate feature from the per-finding second opinion (second-opinion.ts),
 * not a replacement for it. Checks the REPORT'S actual, reviewer-set Top 3
 * selection (and its own aggregate recommended actions) against the
 * client's stated goal, using the real "Goal Relevance Ranking Rubric" —
 * confirmed 2026-09-04 to mean the three real, already-existing pieces
 * this codebase uses to rank/select Top 3: the GoalRelevance semantic
 * definitions, the deterministic default-ranking formula
 * (computeDefaultRankingScore), and the fix-first criteria
 * (isFixFirstCandidate) — see src/lib/reports/ranking-rubric.ts, which is
 * where those are now assembled from, not re-derived here.
 *
 * Unlike the per-finding version, this checks a SELECTION across multiple
 * findings, not one finding's own internal quality — it never re-derives
 * any finding's own score itself (every score/fix-first/cascade signal is
 * computed in code and handed over as "already computed, do not
 * recompute," same discipline as every numeric-benchmark rule in this
 * codebase). Its own response is a real array of concerns (not a single
 * concern/category/reasoning triple like the per-finding version), since a
 * multi-finding selection can have more than one thing wrong with it at
 * once.
 *
 * Same non-negotiable constraints as the per-finding version: purely
 * advisory, zero interaction with the mandatory review gate, reviewer-
 * triggered on demand only, never wired into runAudit()'s critical path.
 */

export const REPORT_SECOND_OPINION_CATEGORIES = [
  "missing_fix_first_finding",
  "healthy_finding_in_top3",
  "top3_misaligned_with_goal",
  "recommendations_dont_match_goal",
  "other",
] as const;

export type ReportSecondOpinionCategory = (typeof REPORT_SECOND_OPINION_CATEGORIES)[number];

export interface ReportSecondOpinionConcern {
  category: ReportSecondOpinionCategory;
  /** Which finding(s) this concern is about — may be empty for a general, report-wide observation. Always validated against the report's real finding IDs before being trusted, never the model's own claim alone. */
  findingIds: string[];
  reasoning: string;
}

export interface ReportSecondOpinionResult {
  concerns: ReportSecondOpinionConcern[];
  /** Always present, even when concerns is empty — a real, useful summary, not just a non-answer. */
  overallAssessment: string;
}

/** One finding's real content plus its deterministically-computed ranking signals — the shape both Top 3 and non-Top-3 findings are described in. */
export interface FindingWithRankingSignals {
  id: string;
  finding: LensFinding;
  rankingScore: number;
  isFixFirstCandidate: boolean;
  cascadeCount: number;
}

const rawConcernSchema = z.object({
  category: z.string(),
  findingIds: z.array(z.string()).optional(),
  reasoning: z.string(),
});

const rawReportSecondOpinionResponseSchema = z.object({
  concerns: z.array(rawConcernSchema),
  overallAssessment: z.string(),
});

/**
 * Deterministic backstop — never trust the model's own category or
 * finding-ID claims blindly, same two-layer discipline as every other
 * "prompt-only instruction isn't fully reliable" fix in this codebase
 * (and the exact same hallucinated-ID validation already used by Conflict
 * Detection and AI Opportunity Synthesis):
 *   1. Any category not in the real, known set is normalized to "other".
 *   2. Any findingId not present in `validFindingIds` is dropped.
 *   3. A concern that ORIGINALLY named specific findings but has NONE left
 *      after filtering is dropped entirely — same "an opportunity left
 *      with zero valid sources is dropped entirely" precedent as AI
 *      Opportunity Synthesis. A concern that never named any findings
 *      (a genuinely general, report-wide observation) is kept as-is.
 */
export function normalizeReportSecondOpinionResponse(
  raw: { concerns: { category: string; findingIds?: string[]; reasoning: string }[]; overallAssessment: string },
  validFindingIds: string[],
): ReportSecondOpinionResult {
  const validSet = new Set(validFindingIds);
  const knownCategories = new Set<string>(REPORT_SECOND_OPINION_CATEGORIES);

  const concerns: ReportSecondOpinionConcern[] = [];
  for (const c of raw.concerns) {
    const originalIds = c.findingIds ?? [];
    const filteredIds = originalIds.filter((id) => validSet.has(id));
    if (originalIds.length > 0 && filteredIds.length === 0) {
      // Every referenced finding was hallucinated — the concern can't be trusted as stated, drop it entirely.
      continue;
    }
    concerns.push({
      category: knownCategories.has(c.category) ? (c.category as ReportSecondOpinionCategory) : "other",
      findingIds: filteredIds,
      reasoning: c.reasoning,
    });
  }

  return { concerns, overallAssessment: raw.overallAssessment };
}

function formatFindingWithSignals(f: FindingWithRankingSignals): string {
  return `- [id: ${f.id}] "${f.finding.title}" (lens-drafted goalRelevance: ${f.finding.goalRelevance}, severity: ${f.finding.severity}, confidenceLevel: ${f.finding.confidenceLevel})
  Diagnosis: ${f.finding.diagnosis}
  Recommended action: ${f.finding.recommendedAction}
  Already-computed ranking score: ${f.rankingScore} (DO NOT RECOMPUTE — this is final)
  Already-computed fix-first candidate: ${f.isFixFirstCandidate}
  Already-computed cascade count (upstream of N other findings): ${f.cascadeCount}`;
}

export function buildReportSecondOpinionSystemPrompt(): string {
  const goalRelevanceDefs = (Object.keys(GOAL_RELEVANCE_DEFINITIONS) as (keyof typeof GOAL_RELEVANCE_DEFINITIONS)[])
    .map((k) => `- "${k}" (ranking weight ${GOAL_RELEVANCE_WEIGHTS[k]}): ${GOAL_RELEVANCE_DEFINITIONS[k]}`)
    .join("\n");
  const confidenceWeights = (Object.keys(CONFIDENCE_WEIGHTS) as (keyof typeof CONFIDENCE_WEIGHTS)[])
    .map((k) => `"${k}" = ${CONFIDENCE_WEIGHTS[k]}`)
    .join(", ");

  return `You are a second, independent reviewer for the report-level Top 3 selection of an AI execution audit. A human reviewer has already decided which findings are in the report's Top 3 priorities. Your job is NOT to re-rank findings from scratch — every finding's ranking score, fix-first status, and cascade count below is ALREADY COMPUTED DETERMINISTICALLY IN CODE and is final; you must not recompute or second-guess these numbers. Your job is to sanity-check whether the ACTUAL Top 3 selection, given these already-computed signals and the client's stated goal, actually makes sense — before the reviewer approves the report.

THE GOAL RELEVANCE RANKING RUBRIC (the real, existing rubric this codebase uses to rank/select Top 3 — judge against this, not a standard of your own):

GoalRelevance definitions and their ranking weights:
${goalRelevanceDefs}

Default ranking score formula (already applied to every finding below): (goalRelevance weight × 2) + confidence weight, where confidence weights are ${confidenceWeights}.

Fix-first criteria (already applied to every finding below): ${FIX_FIRST_CRITERIA_DESCRIPTION}

WHAT TO CHECK FOR, using the category vocabulary below — a report can have more than one concern at once, list each separately; pick "other" only if none of the specific ones fit:
- "missing_fix_first_finding": a finding marked as a fix-first candidate (or with a clearly high ranking score) is genuinely NOT in the Top 3, and nothing in the actual Top 3 has an equally strong claim to that slot.
- "healthy_finding_in_top3": a finding with goalRelevance "directly_supports" (genuinely healthy/positive news) is sitting in the Top 3 as if it were a priority to fix — a real, known edge case, since a high-confidence healthy finding can numerically outscore a low-confidence real problem under the raw formula.
- "top3_misaligned_with_goal": the actual Top 3, taken as a whole, doesn't reflect the client's stated goal as well as the computed signals suggest it honestly should.
- "recommendations_dont_match_goal": the Top 3's own recommendedAction text, taken together, doesn't coherently point toward what the client actually said they want (the stated goal) — e.g. the recommended actions are real and sensible in isolation but don't add up to genuine progress on the goal.
- "other": a real concern that doesn't fit any category above.

If you have no genuine concern, say so plainly in "overallAssessment" and return an empty "concerns" array — do not manufacture a concern to seem thorough. A clean pass is itself a useful, real answer, not a non-answer. "overallAssessment" is always required, even when there are no concerns.

For every concern, "findingIds" must be the EXACT real id(s) shown in brackets (e.g. "id: abc-123") for the finding(s) the concern is about — never invent an id, and leave "findingIds" empty only for a genuinely general, report-wide observation with no specific finding.

Output strict JSON only, no prose outside it, matching exactly:
{
  "concerns": [
    { "category": "missing_fix_first_finding" | "healthy_finding_in_top3" | "top3_misaligned_with_goal" | "recommendations_dont_match_goal" | "other", "findingIds": string[], "reasoning": string }
  ],
  "overallAssessment": string
}`;
}

export function buildReportSecondOpinionUserMessage(
  goal: GoalContext,
  top3: FindingWithRankingSignals[],
  otherFindings: FindingWithRankingSignals[],
): string {
  return `CLIENT'S STATED GOAL:
${formatGoalContextForPrompt(goal)}

THE REPORT'S ACTUAL TOP 3, IN RANK ORDER (rank 1 first):
${top3.length > 0 ? top3.map((f, i) => `Rank ${i + 1}:\n${formatFindingWithSignals(f)}`).join("\n\n") : "(none selected)"}

EVERY OTHER APPROVED/EDITED FINDING ON THIS REPORT, NOT IN THE TOP 3:
${otherFindings.length > 0 ? otherFindings.map((f) => formatFindingWithSignals(f)).join("\n\n") : "(none — every approved/edited finding on this report is already in the Top 3)"}`;
}

export async function requestReportSecondOpinion(
  goal: GoalContext,
  top3: FindingWithRankingSignals[],
  otherFindings: FindingWithRankingSignals[],
): Promise<ReportSecondOpinionResult & { model: string }> {
  const system = buildReportSecondOpinionSystemPrompt();
  const userMessage = buildReportSecondOpinionUserMessage(goal, top3, otherFindings);

  const completion = await requestSecondOpinionCompletion({ system, userMessage, maxTokens: 3072 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(completion.text);
  } catch (cause) {
    throw new Error(`Report second opinion returned non-JSON output: ${completion.text.slice(0, 300)}`, { cause });
  }

  const result = rawReportSecondOpinionResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Report second opinion response failed schema validation: ${result.error.message}`);
  }

  const validFindingIds = [...top3, ...otherFindings].map((f) => f.id);
  const normalized = normalizeReportSecondOpinionResponse(result.data, validFindingIds);
  return { ...normalized, model: completion.model };
}
