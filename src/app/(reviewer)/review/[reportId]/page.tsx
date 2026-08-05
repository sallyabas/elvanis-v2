import { createAdminClient } from "@/lib/supabase/admin";
import { ReviewWorkspaceClient } from "./ReviewWorkspaceClient";

export default async function ReviewWorkspacePage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  const supabase = createAdminClient();

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, status, top_3_finding_ids, created_at, submitted_at, edit_window_closes_at, approved_at, companies(name)")
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

  const company = report.companies as unknown as { name: string } | null;

  return (
    <ReviewWorkspaceClient
      reportId={report.id}
      companyName={company?.name ?? "Unknown company"}
      reportStatus={report.status}
      top3FindingIds={(report.top_3_finding_ids as string[]) ?? []}
      findings={findings}
      conflicts={conflicts ?? []}
      timing={{
        createdAt: report.created_at,
        submittedAt: report.submitted_at,
        editWindowClosesAt: report.edit_window_closes_at,
        approvedAt: report.approved_at,
      }}
    />
  );
}
