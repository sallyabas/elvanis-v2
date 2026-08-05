import { createAdminClient } from "@/lib/supabase/admin";
import type { LensFinding, LensType } from "@/lib/lenses/types";

/**
 * Case library storage + similar-patterns retrieval (confirmed 2026-08-05,
 * "similar patterns surfacing" pulled forward from V2 as DORMANT
 * infrastructure — "built now, activates automatically once real case
 * volume exists... returns nothing until genuine data exists").
 *
 * Real gap found and closed as a genuine prerequisite, not a scope
 * expansion: spec §4a.3 claims case_library "storage happens from day one"
 * (marked V1), but `case_library` had zero write calls anywhere in this
 * codebase — confirmed by grep. Without storage actually running, the
 * retrieval half would stay dormant forever, not just until real volume
 * exists, which would make the "activates automatically" promise false.
 * `recordCaseLibraryEntry()` closes that: called from `deliverReport()`
 * (a delivered report is a genuinely completed audit worth storing),
 * `stored_for_retrieval` set to true immediately — storage is V1, only
 * RETRIEVAL was ever the V2-gated half, per spec's own framing.
 *
 * `findSimilarPatterns()` is the retrieval half — deliberately
 * conservative: never surfaces a "pattern" from a coincidental one-off
 * match. Requires overlap with at least MIN_OTHER_COMPANIES_FOR_PATTERN
 * genuinely distinct OTHER companies before returning anything at all,
 * same "don't overclaim from thin data" discipline already used for every
 * benchmark/jurisdiction/classification decision in this codebase. Not
 * wired into any client-facing UI yet — surfacing sparse early pattern
 * data to a real client risks looking like a real insight when it's
 * mostly noise; that's a separate, later decision once real case volume
 * actually exists, not assumed here.
 */

const MIN_OTHER_COMPANIES_FOR_PATTERN = 3;

function severityTag(lens: LensType, severity: string): string {
  return `lens:${lens}:severity:${severity}`;
}

/** Called from deliverReport() — a delivered report is a genuinely completed, real audit case. */
export async function recordCaseLibraryEntry(reportId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, company_id, goal_id, companies(industry, stage), goals(primary_goal)")
    .eq("id", reportId)
    .single();
  if (reportError || !report) throw new Error(`recordCaseLibraryEntry: report not found: ${reportError?.message}`);

  const company = report.companies as unknown as { industry: string | null; stage: string | null } | null;
  const goal = report.goals as unknown as { primary_goal: string } | null;

  const { data: findingRows, error: findingsError } = await supabase
    .from("lens_findings")
    .select("lens, ai_draft, reviewer_edited_content, reviewer_status")
    .eq("report_id", reportId);
  if (findingsError) throw new Error(`recordCaseLibraryEntry: failed to load findings: ${findingsError.message}`);

  const tags = new Set<string>();
  if (goal?.primary_goal) tags.add(`goal:${goal.primary_goal}`);
  if (company?.industry) tags.add(`industry:${company.industry}`);
  if (company?.stage) tags.add(`stage:${company.stage}`);

  for (const row of findingRows ?? []) {
    if (row.reviewer_status === "rejected") continue; // rejected findings aren't real signal about this company
    const content = (row.reviewer_edited_content ?? row.ai_draft) as LensFinding;
    if (content?.severity === "critical" || content?.severity === "high") {
      tags.add(severityTag(row.lens as LensType, content.severity));
    }
  }

  const { error: insertError } = await supabase.from("case_library").insert({
    company_id: report.company_id,
    report_id: reportId,
    tags: [...tags],
    stored_for_retrieval: true,
  });
  if (insertError) throw new Error(`recordCaseLibraryEntry: failed to insert: ${insertError.message}`);
}

export interface SimilarPatternMatch {
  companyId: string;
  reportId: string;
  overlappingTags: string[];
  similarityScore: number;
}

/**
 * Dormant until real case volume exists — deliberately returns [] rather
 * than a thin, misleading match whenever fewer than
 * MIN_OTHER_COMPANIES_FOR_PATTERN genuinely distinct other companies show
 * real tag overlap. Never compares a company against its own past cases.
 */
export async function findSimilarPatterns(companyId: string): Promise<SimilarPatternMatch[]> {
  const supabase = createAdminClient();

  const { data: ownEntries, error: ownError } = await supabase
    .from("case_library")
    .select("tags")
    .eq("company_id", companyId)
    .eq("stored_for_retrieval", true);
  if (ownError) throw new Error(`findSimilarPatterns: failed to load own entries: ${ownError.message}`);
  if (!ownEntries || ownEntries.length === 0) return [];

  const ownTags = new Set<string>(ownEntries.flatMap((e) => e.tags as string[]));
  if (ownTags.size === 0) return [];

  const { data: otherEntries, error: otherError } = await supabase
    .from("case_library")
    .select("company_id, report_id, tags")
    .eq("stored_for_retrieval", true)
    .neq("company_id", companyId);
  if (otherError) throw new Error(`findSimilarPatterns: failed to load other entries: ${otherError.message}`);

  const matches: SimilarPatternMatch[] = [];
  for (const entry of otherEntries ?? []) {
    const otherTags = new Set<string>(entry.tags as string[]);
    const overlap = [...ownTags].filter((t) => otherTags.has(t));
    if (overlap.length === 0) continue;
    const union = new Set([...ownTags, ...otherTags]);
    matches.push({
      companyId: entry.company_id as string,
      reportId: entry.report_id as string,
      overlappingTags: overlap,
      similarityScore: overlap.length / union.size,
    });
  }

  const distinctOtherCompanies = new Set(matches.map((m) => m.companyId));
  if (distinctOtherCompanies.size < MIN_OTHER_COMPANIES_FOR_PATTERN) return [];

  return matches.sort((a, b) => b.similarityScore - a.similarityScore);
}
