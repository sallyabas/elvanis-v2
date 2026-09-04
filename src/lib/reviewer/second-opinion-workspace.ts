import { createAdminClient } from "@/lib/supabase/admin";
import { requestSecondOpinionForFinding } from "./second-opinion";
import { FINANCIAL_LENS_RUBRIC } from "@/lib/lenses/financial";
import type { LensFinding, LensType } from "@/lib/lenses/types";
import type { SecondOpinionCategory } from "./second-opinion";

/**
 * Persistence layer for the reviewer second-opinion feature (confirmed
 * 2026-09-04) — reviewer-only, caller (the Server Action) is responsible
 * for the session+role check, same discipline as finding-notes.ts and
 * every other reviewer write in this codebase. Uses the admin client
 * throughout; this table has no RLS (see its own migration's docblock).
 *
 * v1 scope: `findingSource` is always "lens_finding" in practice today —
 * the parameter exists so the schema/functions don't need a second
 * migration once modules are added, matching the same forward-compatible
 * shape already used for finding_feedback.
 */

export type FindingSecondOpinionSource = "lens_finding" | "module_finding";

export interface FindingSecondOpinion {
  id: string;
  findingSource: FindingSecondOpinionSource;
  findingId: string;
  concern: boolean;
  category: SecondOpinionCategory | null;
  reasoning: string;
  model: string;
  requestedBy: string | null;
  createdAt: string;
}

interface FindingSecondOpinionRow {
  id: string;
  finding_source: FindingSecondOpinionSource;
  finding_id: string;
  concern: boolean;
  category: SecondOpinionCategory | null;
  reasoning: string;
  model: string;
  requested_by: string | null;
  created_at: string;
}

function mapRow(row: FindingSecondOpinionRow): FindingSecondOpinion {
  return {
    id: row.id,
    findingSource: row.finding_source,
    findingId: row.finding_id,
    concern: row.concern,
    category: row.category,
    reasoning: row.reasoning,
    model: row.model,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
  };
}

/**
 * Most recent second opinion per finding, keyed by findingId — one query
 * for a whole report's findings, not N, same "one query, not N" pattern
 * already established for loadFindingConciergeNotes()/similarPatterns.
 * A finding can in principle be re-checked more than once (a reviewer
 * asking again after an edit) — only the latest is shown, older ones stay
 * in the table as a log, never deleted.
 */
export async function loadLatestSecondOpinions(findingIds: string[]): Promise<Map<string, FindingSecondOpinion>> {
  if (findingIds.length === 0) return new Map();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("finding_second_opinions")
    .select("*")
    .in("finding_id", findingIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`loadLatestSecondOpinions: ${error.message}`);

  const latestByFindingId = new Map<string, FindingSecondOpinion>();
  for (const row of data as FindingSecondOpinionRow[]) {
    if (!latestByFindingId.has(row.finding_id)) {
      latestByFindingId.set(row.finding_id, mapRow(row));
    }
  }
  return latestByFindingId;
}

/**
 * Calls the second opinion, then persists the result. Never mutates the
 * finding itself, never touches reviewer_status, never interacts with the
 * mandatory review gate in any way — purely additive, advisory data.
 */
export async function requestAndPersistSecondOpinion(
  findingSource: FindingSecondOpinionSource,
  findingId: string,
  finding: LensFinding,
  lensLabel: string,
  rubricText: string,
  reviewerId: string,
): Promise<FindingSecondOpinion> {
  const result = await requestSecondOpinionForFinding(finding, lensLabel, rubricText);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("finding_second_opinions")
    .insert({
      finding_source: findingSource,
      finding_id: findingId,
      concern: result.concern,
      category: result.category,
      reasoning: result.reasoning,
      model: result.model,
      requested_by: reviewerId,
    })
    .select("*")
    .single();
  if (error) throw new Error(`requestAndPersistSecondOpinion: ${error.message}`);

  return mapRow(data as FindingSecondOpinionRow);
}

/**
 * The one real entry point the reviewer workspace's Server Action calls
 * (confirmed 2026-09-04) — loads the finding fresh from the DB (never
 * trusts a client-supplied finding payload), enforces v1's real scope
 * server-side (Financial lens only, on THIS report) rather than only
 * hiding the button in the UI for other lenses, and maps the lens to its
 * own rubric constant. Extending to another lens later means adding one
 * more case here, not touching the caller.
 */
export async function requestFinancialLensSecondOpinion(reportId: string, findingId: string, reviewerId: string): Promise<FindingSecondOpinion> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("lens_findings")
    .select("id, report_id, lens, ai_draft, reviewer_edited_content")
    .eq("id", findingId)
    .single();
  if (error || !row) throw new Error("Finding not found.");
  if (row.report_id !== reportId) throw new Error("Finding does not belong to this report.");

  const lens = row.lens as LensType;
  if (lens !== "financial") {
    throw new Error(`Second opinion is scoped to the Financial lens in v1 — this finding belongs to the "${lens}" lens.`);
  }

  const finding = (row.reviewer_edited_content ?? row.ai_draft) as LensFinding;
  return requestAndPersistSecondOpinion("lens_finding", findingId, finding, "Financial", FINANCIAL_LENS_RUBRIC, reviewerId);
}
