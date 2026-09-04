import { z } from "zod";
import { requestSecondOpinionCompletion } from "@/lib/second-opinion-client";
import type { LensFinding } from "@/lib/lenses/types";

/**
 * Reviewer "second opinion" — a structured, reviewer-triggered-on-demand
 * review of a single core-audit finding from a genuinely different model
 * (Claude, via src/lib/second-opinion-client) than whatever drafted the
 * finding (Groq, via src/lib/ai-client), using that lens's own real rubric
 * (e.g. FINANCIAL_LENS_RUBRIC in financial.ts) as the review instructions
 * — never a second, independently-invented rulebook that could drift from
 * what the finding was actually drafted against.
 *
 * Purely advisory — this module has ZERO interaction with the mandatory
 * review gate (reports_sent_requires_reviewer and the equivalent module
 * flow). It can flag a concern; it cannot accept, reject, or block
 * anything. Non-negotiable, per direct founder confirmation 2026-09-04.
 *
 * v1 scope: core-audit lens_findings only (financial.ts first). Modules
 * deferred until this is validated — see finding_second_opinions'
 * migration for the schema decision that already anticipates the
 * extension without a second migration.
 *
 * Build order, confirmed 2026-09-04: this file's deterministic logic
 * (prompt construction, response validation, the normalization backstop
 * below) is test-first — see second-opinion.test-cases.ts, which must
 * pass before any live Claude call is wired into the reviewer workspace.
 * What this test suite CANNOT verify without a real ANTHROPIC_API_KEY:
 * whether Claude's actual JUDGMENT is any good (does it really catch an
 * unactionable recommendation, a duplicate, etc.) — that requires a real
 * live run once a key exists, disclosed honestly rather than assumed.
 */

export const SECOND_OPINION_CATEGORIES = [
  "possible_duplicate",
  "unsupported_confidence",
  "healthy_finding_miscategorized",
  "goal_relevance_mismatch",
  /**
   * Added 2026-09-04, direct founder request — the diagnosis is correct,
   * but recommendedAction is too vague or dependency-blocked for the
   * client to act on within 30 days. Flagged as the single most common
   * real reviewer edit, so this category exists from day one, not added
   * after the fact once observed.
   */
  "unactionable_recommendation",
  "other",
] as const;

export type SecondOpinionCategory = (typeof SECOND_OPINION_CATEGORIES)[number];

/**
 * The raw shape Claude's own response must match. Deliberately permissive
 * on `category` (nullable, not required to be present even when
 * concern=true) — normalizeSecondOpinionResponse() below is what actually
 * enforces the real invariant, not this schema alone. Same "validate the
 * shape, then apply a deterministic backstop on top" two-layer discipline
 * already used everywhere else in this codebase (trace-logs dedup,
 * missing-documentation dedup, Article 4 dedup).
 */
const rawSecondOpinionResponseSchema = z.object({
  concern: z.boolean(),
  category: z.string().nullable().optional(),
  reasoning: z.string(),
});

export interface SecondOpinionResult {
  concern: boolean;
  category: SecondOpinionCategory | null;
  reasoning: string;
}

/**
 * Deterministic backstop — never trust the model's own concern/category
 * pairing blindly, same discipline as every other "prompt-only instruction
 * isn't fully reliable" fix in this codebase:
 *   1. concern=false always forces category to null, regardless of what
 *      the model returned — a "no concern" verdict with a category
 *      attached is a contradiction the UI shouldn't have to reason about.
 *   2. concern=true with a missing/null/unrecognized category is
 *      normalized to "other" — never surfaced as a concern with nothing
 *      to show the reviewer.
 */
export function normalizeSecondOpinionResponse(raw: {
  concern: boolean;
  category?: string | null;
  reasoning: string;
}): SecondOpinionResult {
  if (!raw.concern) {
    return { concern: false, category: null, reasoning: raw.reasoning };
  }

  const isKnownCategory = (SECOND_OPINION_CATEGORIES as readonly string[]).includes(raw.category ?? "");
  const category = isKnownCategory ? (raw.category as SecondOpinionCategory) : "other";
  return { concern: true, category, reasoning: raw.reasoning };
}

/**
 * The system prompt: the lens's own real rubric, plus the task framing and
 * a strict output-shape instruction. `rubricText` is always the exact
 * string a lens's own drafting prompt already contains (e.g.
 * FINANCIAL_LENS_RUBRIC) — passed in by the caller, never re-derived or
 * paraphrased here, so this can never silently diverge from what the
 * finding was actually drafted against.
 */
export function buildSecondOpinionSystemPrompt(lensLabel: string, rubricText: string): string {
  return `You are a second, independent reviewer for the ${lensLabel} lens of an AI execution audit. A first AI model already drafted the finding below, following the rubric below. Your job is NOT to redraft it — it is to give a reviewer a structured second opinion on whether this specific finding, as drafted, actually holds up against its own rubric, before that reviewer decides whether to approve, edit, or reject it.

THE RUBRIC THE FINDING WAS DRAFTED AGAINST (the same rules the first model was given — judge the finding against these, not a different standard of your own):
${rubricText}

WHAT TO CHECK FOR, using the category vocabulary below — pick the single best-fitting category if you have a concern, "other" only if none of the specific ones fit:
- "possible_duplicate": this finding looks like it's re-raising a gap (e.g. missing evidence, a structural absence) that a deterministic, code-injected finding on this same report is already guaranteed to cover separately — a common, previously-observed failure mode in this system.
- "unsupported_confidence": the stated confidenceLevel (or the certainty implied by the wording) is higher than the cited evidence actually supports — e.g. a firm claim built on thin, vague, or absent evidenceCited.
- "healthy_finding_miscategorized": this is actually good/healthy news for the business, but it's been worded or classified (e.g. via goalRelevance or severity) as if it were a problem.
- "goal_relevance_mismatch": the goalRelevance value doesn't honestly match what the finding actually describes — e.g. a real, material, quantifiable drag on the stated goal marked as merely "indirectly_affects," or a genuinely central obstruction marked as anything less than "directly_blocks."
- "unactionable_recommendation": the diagnosis is correct, but recommendedAction is too vague (e.g. "improve X," "monitor Y" with no concrete next step) or depends on something outside the client's own control to happen first, such that a client genuinely could not act on it within 30 days.
- "other": a real concern that doesn't fit any category above.

If you have no genuine concern, say so plainly — do not manufacture a concern to seem thorough. A clean pass is itself a useful, real answer, not a non-answer.

Output strict JSON only, no prose outside it, matching exactly:
{
  "concern": boolean,
  "category": "possible_duplicate" | "unsupported_confidence" | "healthy_finding_miscategorized" | "goal_relevance_mismatch" | "unactionable_recommendation" | "other" | null,
  "reasoning": string
}
"category" must be null when "concern" is false, and must be one of the listed values (never null, never invented) when "concern" is true.`;
}

/** The finding's own content, exactly as the reviewer already sees it — nothing paraphrased or summarized before being shown to the second opinion. */
export function buildSecondOpinionUserMessage(finding: LensFinding): string {
  return `FINDING TO REVIEW:
Title: ${finding.title}
Diagnosis: ${finding.diagnosis}
Root cause: ${finding.rootCause}
Recommended action: ${finding.recommendedAction}
Severity: ${finding.severity}
Confidence level: ${finding.confidenceLevel}
Goal relevance: ${finding.goalRelevance}
Is missing-data finding: ${finding.isMissingDataFinding}
Evidence cited: ${finding.evidenceCited.length > 0 ? finding.evidenceCited.join(", ") : "(none listed)"}`;
}

export async function requestSecondOpinionForFinding(finding: LensFinding, lensLabel: string, rubricText: string): Promise<SecondOpinionResult & { model: string }> {
  const system = buildSecondOpinionSystemPrompt(lensLabel, rubricText);
  const userMessage = buildSecondOpinionUserMessage(finding);

  const completion = await requestSecondOpinionCompletion({ system, userMessage });

  let parsed: unknown;
  try {
    parsed = JSON.parse(completion.text);
  } catch (cause) {
    throw new Error(`Second opinion returned non-JSON output: ${completion.text.slice(0, 300)}`, { cause });
  }

  const result = rawSecondOpinionResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Second opinion response failed schema validation: ${result.error.message}`);
  }

  const normalized = normalizeSecondOpinionResponse(result.data);
  return { ...normalized, model: completion.model };
}
