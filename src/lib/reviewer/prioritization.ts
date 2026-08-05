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
 * of anything else. "high" only qualifies when it also directly blocks the
 * client's stated goal, since a high-impact-but-goal-unrelated finding is a
 * candidate for later, not necessarily top-3 right now.
 */
export function isFixFirstCandidate(finding: LensFinding): boolean {
  if (finding.severity === "critical") return true;
  return finding.severity === "high" && finding.goalRelevance === "directly_blocks";
}
