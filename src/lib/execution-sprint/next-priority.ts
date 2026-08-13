import type { SupabaseClient } from "@supabase/supabase-js";
import type { LensFinding, LensType, Severity } from "@/lib/lenses/types";
import { isFixFirstCandidate } from "@/lib/reviewer/prioritization";

/**
 * Sprint-completion bridge (confirmed 2026-08-13, direct founder request,
 * item 4 of the old-Elvanis-inspired batch) — once a client finishes their
 * one Execution Sprint, nothing previously pointed them back to the
 * roadmap for what's next; the client page's "complete" state just showed
 * the reviewer's final commentary and stopped there. This closes that gap
 * deterministically, reusing the same `isFixFirstCandidate()` reasoning
 * already used for the reviewer's own "fix this first" suggestions —
 * never a new AI judgment, same discipline as every other cross-lens
 * prioritization decision in this codebase.
 */
export interface NextPriorityFinding {
  findingId: string;
  lens: LensType;
  title: string;
  severity: Severity;
  isFixFirstCandidate: boolean;
}

interface FindingRow {
  id: string;
  lens: LensType;
  ai_draft: LensFinding;
  reviewer_edited_content: LensFinding | null;
  reviewer_status: string;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

function displayedContent(f: FindingRow): LensFinding {
  return f.reviewer_edited_content ?? f.ai_draft;
}

/**
 * Finds the next real priority for a client whose sprint just addressed
 * one finding — the same report's other reviewer-approved/edited findings,
 * ranked fix-first-candidates first, then by severity, excluding the
 * finding this sprint already covers and excluding missing-evidence
 * findings (nothing to "implement" when the gap is "you didn't submit
 * evidence" — same threshold `isFixFirstCandidate()` and the client
 * report page's own sprint-interest button already use). Returns null
 * when there's genuinely nothing left to surface — a real, honest
 * outcome, not an error state.
 */
export async function findNextPriorityFinding(supabase: SupabaseClient, reportId: string, excludeFindingId: string): Promise<NextPriorityFinding | null> {
  const { data: findings, error } = await supabase.from("lens_findings").select("id, lens, ai_draft, reviewer_edited_content, reviewer_status").eq("report_id", reportId);
  if (error || !findings) return null;

  const candidates = (findings as FindingRow[])
    .filter((f) => f.id !== excludeFindingId && (f.reviewer_status === "approved" || f.reviewer_status === "edited"))
    .map((f) => ({ row: f, content: displayedContent(f) }))
    .filter(({ content }) => !content.isMissingDataFinding);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aFixFirst = isFixFirstCandidate(a.content) ? 1 : 0;
    const bFixFirst = isFixFirstCandidate(b.content) ? 1 : 0;
    if (aFixFirst !== bFixFirst) return bFixFirst - aFixFirst;
    return SEVERITY_RANK[b.content.severity] - SEVERITY_RANK[a.content.severity];
  });

  const top = candidates[0];
  return {
    findingId: top.row.id,
    lens: top.row.lens,
    title: top.content.title,
    severity: top.content.severity,
    isFixFirstCandidate: isFixFirstCandidate(top.content),
  };
}
