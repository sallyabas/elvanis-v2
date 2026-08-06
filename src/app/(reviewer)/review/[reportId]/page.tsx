import { createAdminClient } from "@/lib/supabase/admin";
import { findSimilarPatterns } from "@/lib/synthesis/case-library";
import { loadRecommendationLibrary } from "@/lib/recommendations/repository";
import { ReviewWorkspaceClient } from "./ReviewWorkspaceClient";

export default async function ReviewWorkspacePage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const supabase = createAdminClient();

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select(
      "id, status, company_id, top_3_finding_ids, created_at, submitted_at, edit_window_closes_at, approved_at, source_evidence_snapshot, rerun_of_report_id, companies(name, user_id, users(plan_tier))",
    )
    .eq("id", reportId)
    .single();

  if (reportError || !report) {
    return <div className="p-6 text-sm text-red-600">Failed to load report: {reportError?.message ?? "not found"}</div>;
  }

  const { data: findings, error: findingsError } = await supabase
    .from("lens_findings")
    .select(
      "id, lens, ai_draft, reviewer_edited_content, reviewer_status, reviewer_notes, confidence_level, is_missing_data_finding, origin, client_confidence_marking, is_disputed, dispute_resolution_notes",
    )
    .eq("report_id", reportId)
    .order("lens", { ascending: true });

  if (findingsError) {
    return <div className="p-6 text-sm text-red-600">Failed to load findings: {findingsError.message}</div>;
  }

  const findingIds = findings.map((f) => f.id);
  const { data: conflicts, error: conflictsError } =
    findingIds.length > 0
      ? await supabase
          .from("finding_conflicts")
          .select("id, finding_a_id, finding_b_id, conflict_description, resolution_status, reviewer_notes")
          .or(`finding_a_id.in.(${findingIds.join(",")}),finding_b_id.in.(${findingIds.join(",")})`)
      : { data: [], error: null };

  if (conflictsError) {
    return <div className="p-6 text-sm text-red-600">Failed to load conflicts: {conflictsError.message}</div>;
  }

  const company = report.companies as unknown as { name: string; user_id: string; users: { plan_tier: string } | { plan_tier: string }[] | null } | null;
  const ownerUsersRow = Array.isArray(company?.users) ? company?.users[0] : company?.users;

  // Dormant similar-patterns infrastructure, now surfaced in the reviewer
  // workspace (confirmed 2026-08-06) — genuinely returns [] until real case
  // volume exists (≥3 distinct other companies with real tag overlap), see
  // src/lib/synthesis/case-library.ts. Reviewer-only, never client-facing —
  // showing a client cross-company patterns would leak other clients' data.
  const similarPatterns = await findSimilarPatterns(report.company_id as string);
  const patternCompanyIds = [...new Set(similarPatterns.map((p) => p.companyId))];
  const { data: patternCompanies } =
    patternCompanyIds.length > 0 ? await supabase.from("companies").select("id, name").in("id", patternCompanyIds) : { data: [] };
  const patternCompanyNames = new Map((patternCompanies ?? []).map((c) => [c.id as string, c.name as string]));

  // Recommendation library, DB-backed as of 2026-08-06 (see
  // recommendations/repository.ts) — fetched here server-side and passed
  // down as a prop, since EditForm (a client component) previously
  // imported RECOMMENDATION_LIBRARY directly, which broke once it became
  // an async DB read. Same refactor pattern as GOVERNANCE_DIMENSIONS.
  const recommendationLibrary = await loadRecommendationLibrary();

  return (
    <ReviewWorkspaceClient
      reportId={report.id}
      companyName={company?.name ?? "Unknown company"}
      companyUserId={company?.user_id ?? null}
      planTier={ownerUsersRow?.plan_tier ?? "free"}
      reportStatus={report.status}
      top3FindingIds={(report.top_3_finding_ids as string[]) ?? []}
      canRerun={report.source_evidence_snapshot !== null}
      rerunOfReportId={report.rerun_of_report_id as string | null}
      similarPatterns={similarPatterns.map((p) => ({ ...p, companyName: patternCompanyNames.get(p.companyId) ?? "Unknown company" }))}
      findings={findings}
      conflicts={conflicts ?? []}
      recommendationLibrary={recommendationLibrary}
      timing={{
        createdAt: report.created_at,
        submittedAt: report.submitted_at,
        editWindowClosesAt: report.edit_window_closes_at,
        approvedAt: report.approved_at,
      }}
    />
  );
}
