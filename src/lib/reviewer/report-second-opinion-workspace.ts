import { createAdminClient } from "@/lib/supabase/admin";
import { loadGoalContext } from "@/lib/audit/load-profile";
import { resolveTop3FindingsInOrder } from "@/lib/reports/top3";
import { computeDefaultRankingScore } from "@/lib/reports/ranking-rubric";
import { isFixFirstCandidate } from "./prioritization";
import { computeCascadeSignals } from "@/lib/recommendations/cascade";
import { loadRecommendationLibrary } from "@/lib/recommendations/repository";
import { requestReportSecondOpinion, type FindingWithRankingSignals, type ReportSecondOpinionCategory } from "./report-second-opinion";
import type { LensFinding, LensType } from "@/lib/lenses/types";

/**
 * Persistence + orchestration layer for the report-level second opinion
 * (confirmed 2026-09-04) — reviewer-only, caller (the Server Action) is
 * responsible for the session+role check, same discipline as
 * second-opinion-workspace.ts and every other reviewer write in this
 * codebase. Uses the admin client throughout; report_second_opinions has
 * no RLS (see its own migration's docblock).
 */

export interface ReportSecondOpinionConcernRow {
  category: ReportSecondOpinionCategory;
  findingIds: string[];
  reasoning: string;
}

export interface ReportSecondOpinion {
  id: string;
  reportId: string;
  concerns: ReportSecondOpinionConcernRow[];
  overallAssessment: string;
  model: string;
  requestedBy: string | null;
  createdAt: string;
}

interface ReportSecondOpinionRow {
  id: string;
  report_id: string;
  concerns: ReportSecondOpinionConcernRow[];
  overall_assessment: string;
  model: string;
  requested_by: string | null;
  created_at: string;
}

function mapRow(row: ReportSecondOpinionRow): ReportSecondOpinion {
  return {
    id: row.id,
    reportId: row.report_id,
    concerns: row.concerns,
    overallAssessment: row.overall_assessment,
    model: row.model,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
  };
}

/** Most recent report-level second opinion for a report, or null if never requested. A report can in principle be re-checked more than once (after a re-rank) — only the latest is shown; older ones stay as a log. */
export async function loadLatestReportSecondOpinion(reportId: string): Promise<ReportSecondOpinion | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("report_second_opinions")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`loadLatestReportSecondOpinion: ${error.message}`);
  return data ? mapRow(data as ReportSecondOpinionRow) : null;
}

/**
 * Builds every approved/edited finding's real ranking signals (score,
 * fix-first, cascade count) — all deterministic, computed here in code and
 * handed to the second opinion as already-final facts, never re-derived by
 * the model. Exported so the test suite can exercise this exact logic
 * with a hand-built finding set and DEFAULT_RECOMMENDATION_LIBRARY,
 * without a live DB call.
 */
export function buildFindingsWithSignals(
  findings: { id: string; lens: LensType; finding: LensFinding }[],
  library: Awaited<ReturnType<typeof loadRecommendationLibrary>>,
): FindingWithRankingSignals[] {
  const cascadeSignals = computeCascadeSignals(
    findings.map((f) => ({ id: f.id, lens: f.lens, title: f.finding.title, diagnosis: f.finding.diagnosis })),
    library,
  );

  return findings.map((f) => {
    const cascadeCount = cascadeSignals.get(f.id)?.cascadeCount ?? 0;
    return {
      id: f.id,
      finding: f.finding,
      rankingScore: computeDefaultRankingScore(f.finding),
      isFixFirstCandidate: isFixFirstCandidate(f.finding, cascadeCount),
      cascadeCount,
    };
  });
}

/**
 * The one real entry point the reviewer workspace's Server Action calls —
 * loads the report's real goal, real approved/edited findings, and real
 * Top 3 selection fresh from the DB (never trusts a client-supplied
 * payload), computes every deterministic ranking signal, calls the second
 * opinion, and persists the result.
 */
export async function requestReportTop3SecondOpinion(reportId: string, reviewerId: string): Promise<ReportSecondOpinion> {
  const admin = createAdminClient();

  const { data: report, error: reportError } = await admin.from("reports").select("id, company_id, top_3_finding_ids").eq("id", reportId).single();
  if (reportError || !report) throw new Error("Report not found.");

  // Most recent goal for this company — same "current goal" pattern
  // already used on Business Profile / the reviewer company detail page.
  const { data: goalRow, error: goalError } = await admin
    .from("goals")
    .select("id")
    .eq("company_id", report.company_id as string)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (goalError) throw new Error(`requestReportTop3SecondOpinion: ${goalError.message}`);
  if (!goalRow) throw new Error("No goal found for this company — cannot check Top 3 against a goal that doesn't exist.");
  const goal = await loadGoalContext(admin, goalRow.id as string);

  const { data: findingRows, error: findingsError } = await admin
    .from("lens_findings")
    .select("id, lens, ai_draft, reviewer_edited_content, reviewer_status")
    .eq("report_id", reportId)
    .in("reviewer_status", ["approved", "edited"]);
  if (findingsError) throw new Error(`requestReportTop3SecondOpinion: ${findingsError.message}`);

  const allFindings = (findingRows ?? []).map((row) => ({
    id: row.id as string,
    lens: row.lens as LensType,
    finding: (row.reviewer_edited_content ?? row.ai_draft) as LensFinding,
  }));

  const library = await loadRecommendationLibrary();
  const withSignals = buildFindingsWithSignals(allFindings, library);

  const top3 = resolveTop3FindingsInOrder((report.top_3_finding_ids as string[]) ?? [], withSignals);
  const top3Ids = new Set(top3.map((f) => f.id));
  const otherFindings = withSignals.filter((f) => !top3Ids.has(f.id));

  const result = await requestReportSecondOpinion(goal, top3, otherFindings);

  const { data, error } = await admin
    .from("report_second_opinions")
    .insert({
      report_id: reportId,
      concerns: result.concerns,
      overall_assessment: result.overallAssessment,
      model: result.model,
      requested_by: reviewerId,
    })
    .select("*")
    .single();
  if (error) throw new Error(`requestReportTop3SecondOpinion: ${error.message}`);

  return mapRow(data as ReportSecondOpinionRow);
}
