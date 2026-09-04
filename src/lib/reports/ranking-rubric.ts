import type { GoalRelevance, ConfidenceLevel, LensFinding } from "@/lib/lenses/types";

/**
 * The real, deterministic Top-3 default-ranking formula (confirmed
 * 2026-09-04, extracted from run-audit.ts's own former `scoreForDefaultRanking()`
 * so this exact logic can be reused, verbatim, as real described context
 * for the reviewer's report-level second opinion — never re-derived or
 * paraphrased, so the two can't silently diverge). run-audit.ts now
 * imports and calls this function directly instead of keeping its own
 * private copy — one real implementation, not two.
 *
 * directly_blocks outranks directly_affects outranks directly_supports,
 * even though all three are "directly" tied to the goal — top-3 is about
 * what needs ACTION. directly_blocks and directly_affects are both real
 * problems (the primary obstruction vs. a direct, material cost/drag that
 * isn't the primary cause); directly_supports is healthy/positive and
 * isn't a fix-first candidate the way either problem-finding is, however
 * directly relevant it is. See the GoalRelevance docblock in lenses/types.ts
 * for the full history of why these five values exist.
 */
export const GOAL_RELEVANCE_WEIGHTS: Record<GoalRelevance, number> = {
  directly_blocks: 4,
  directly_affects: 3,
  directly_supports: 2,
  indirectly_affects: 1,
  unrelated: 0,
};

export const CONFIDENCE_WEIGHTS: Record<ConfidenceLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
  insufficient: 0,
};

export function computeDefaultRankingScore(f: LensFinding): number {
  return GOAL_RELEVANCE_WEIGHTS[f.goalRelevance] * 2 + CONFIDENCE_WEIGHTS[f.confidenceLevel];
}

/**
 * Clean, current semantic definitions of each GoalRelevance value —
 * deliberately distinct from that type's own docblock in lenses/types.ts,
 * which is mostly a historical engineering narrative (why each value was
 * added, which exact hallucination it fixed) rather than a definition
 * safe to hand to a reviewer, a second opinion, or a future UI tooltip
 * as-is. This is the stable, CURRENT meaning only.
 */
export const GOAL_RELEVANCE_DEFINITIONS: Record<GoalRelevance, string> = {
  directly_blocks: "The primary, dominant obstruction of the client's stated goal — the central thing standing in the way of it.",
  directly_affects:
    "A real, material, often-quantifiable cost or drag on the goal, but NOT itself the primary/dominant cause of missing it.",
  directly_supports:
    "Genuinely healthy/positive and materially, directly relevant to the goal — good news, not a problem to fix.",
  indirectly_affects: "A real but tangential, non-primary bearing on the goal — not a direct or clearly traceable link.",
  unrelated: "No meaningful bearing on the client's stated goal.",
};

/**
 * Plain-English description of isFixFirstCandidate()'s real, deterministic
 * criteria (src/lib/reviewer/prioritization.ts) — kept here as verified
 * prose rather than imported code, since that function's own logic isn't
 * itself a string; this text must be kept in sync with that function if
 * its thresholds ever change (both live in this same "ranking rubric"
 * concept, cross-referenced deliberately rather than duplicated silently).
 */
export const FIX_FIRST_CRITERIA_DESCRIPTION =
  'A finding is a "fix-first" candidate — deserving priority attention regardless of the default ranking score above — when ANY of these are true: (1) its severity is "critical", full stop; (2) its severity is "high" AND its goalRelevance is "directly_blocks" or "directly_affects" (a high-severity direct cost is just as much a fix-first candidate as a high-severity direct blocker); (3) it is upstream of 2 or more OTHER real findings on the same report (a "cascade" signal — fixing it has an outsized effect on the whole picture, not just itself).';
