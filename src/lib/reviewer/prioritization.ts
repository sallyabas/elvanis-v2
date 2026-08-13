import type { LensFinding } from "@/lib/lenses/types";

/**
 * "Fix this first" is a deterministic flag, not an LLM judgment — same
 * pattern as metrics.ts/ai-governance-framework.ts (confirmed 2026-08-01).
 * It only ever SUGGESTS a promotion to top-3; reviewers still re-rank by
 * hand via reRankTop3, this never writes to the report itself.
 *
 * Criteria: severity is already "business impact if left unaddressed"
 * (see Severity docblock in lenses/types.ts), independent of confidence and
 * goal-relevance — so "critical" alone already means fix first regardless
 * of anything else. "high" only qualifies when it's also directly tied to
 * the client's stated goal — either as the primary obstruction
 * ("directly_blocks") or as a real, material, directly-traceable cost/drag
 * on it that isn't the primary cause ("directly_affects", added 2026-08-05
 * alongside the GoalRelevance value itself — a high-severity direct cost is
 * just as much a fix-first candidate as a high-severity direct blocker,
 * the distinction between them is causal centrality, not reviewer
 * priority) — since a high-impact-but-goal-unrelated finding is a candidate
 * for later, not necessarily top-3 right now.
 *
 * Cascade signal (added 2026-08-13, item 1 of the old-Elvanis-inspired
 * batch, see recommendations/cascade.ts) — a finding that's genuinely
 * upstream of 2+ OTHER real findings on the same report is worth fixing
 * first regardless of its own severity, since fixing it has an outsized
 * effect on the whole picture, not just itself. The threshold (2) is a
 * deliberate, disclosed judgment call, not derived from data: 1 downstream
 * finding is common enough in the curated cascade map to be unremarkable,
 * while 2+ is a genuinely concentrated signal worth a reviewer's attention.
 * `cascadeCount` defaults to 0 so every existing single-argument call site
 * keeps its exact prior behavior unchanged — only callers that have
 * computed real cascade data (currently: the reviewer workspace) opt in.
 */
export function isFixFirstCandidate(finding: LensFinding, cascadeCount = 0): boolean {
  if (finding.severity === "critical") return true;
  if (finding.severity === "high" && (finding.goalRelevance === "directly_blocks" || finding.goalRelevance === "directly_affects")) return true;
  return cascadeCount >= 2;
}
