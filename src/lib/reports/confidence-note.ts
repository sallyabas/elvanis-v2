import type { ConfidenceLevel } from "@/lib/lenses/types";

/**
 * Client-facing confidence note (confirmed 2026-09-03, direct founder
 * request) — `confidenceLevel` has existed on every finding, across all
 * 5 core lenses and all 3 modules, since the original "FINDING STRUCTURE"
 * schema work — but it was only ever shown to the reviewer (a plain
 * "· confidence: X" line + editable dropdown on FindingCard), stripped
 * before delivery. No new data capture needed: the client report page,
 * module detail page, and /demo-live all already fetch the full
 * ai_draft/reviewer_edited_content blob confidenceLevel lives on — this
 * is a display-only addition, one shared source of truth so the three
 * surfaces can't independently drift on the copy or the condition.
 *
 * Deliberately excludes isMissingDataFinding rows — those already carry
 * their own distinct "No evidence submitted" badge; a second, separate
 * "low confidence" note on a finding that's already explicitly flagged
 * as evidence-free would be redundant, not additionally informative.
 */
export const LOW_CONFIDENCE_NOTE = "This finding carries lower confidence — worth discussing with your reviewer if it matters to your decision.";

export function shouldShowLowConfidenceNote(finding: { isMissingDataFinding: boolean; confidenceLevel: ConfidenceLevel }): boolean {
  if (finding.isMissingDataFinding) return false;
  return finding.confidenceLevel === "low" || finding.confidenceLevel === "insufficient";
}
