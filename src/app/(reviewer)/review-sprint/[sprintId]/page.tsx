import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { SprintReviewWorkspaceClient } from "./SprintReviewWorkspaceClient";
import type { LensFinding } from "@/lib/lenses/types";

export default async function SprintReviewWorkspacePage({ params }: { params: Promise<{ sprintId: string }> }) {
  const { sprintId } = await params;
  const supabase = createAdminClient();

  const { data: sprint, error: sprintError } = await supabase
    .from("execution_sprints")
    .select("id, status, signed_off_at, reviewer_commentary, selected_finding_id, company_id, companies(name)")
    .eq("id", sprintId)
    .single();

  if (sprintError || !sprint) {
    return <div className="p-6 text-sm text-red-600">Failed to load sprint: {sprintError?.message ?? "not found"}</div>;
  }

  const { data: finding } = await supabase
    .from("lens_findings")
    .select("ai_draft, reviewer_edited_content")
    .eq("id", sprint.selected_finding_id)
    .single();
  const findingContent = (finding?.reviewer_edited_content ?? finding?.ai_draft) as LensFinding | undefined;

  const { data: tasks, error: tasksError } = await supabase
    .from("sprint_tasks")
    .select("id, task_description, owner, kpi_description, kpi_target_value, kpi_unit, kpi_actual_value, kpi_direction, status, due_date, reviewer_status")
    .eq("execution_sprint_id", sprintId)
    .order("created_at", { ascending: true });

  if (tasksError) {
    return <div className="p-6 text-sm text-red-600">Failed to load tasks: {tasksError.message}</div>;
  }

  const company = sprint.companies as unknown as { name: string } | null;

  return (
    <>
      {/* Real navigation-audit fix (confirmed 2026-08-26) — see the
          equivalent fix's docblock in review/[reportId]/page.tsx. Own
          mx-auto/px-6 wrapper, not shared with SprintReviewWorkspaceClient
          below (which already wraps itself the same way). */}
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <Link
          href={`/company/${sprint.company_id}`}
          className="inline-block text-sm text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          ← {company?.name ?? "Unknown company"}
        </Link>
      </div>
      <SprintReviewWorkspaceClient
        sprintId={sprint.id}
        companyName={company?.name ?? "Unknown company"}
        findingTitle={findingContent?.title ?? "Unknown finding"}
        sprintStatus={sprint.status}
        signedOffAt={sprint.signed_off_at}
        reviewerCommentary={sprint.reviewer_commentary}
        tasks={tasks ?? []}
      />
    </>
  );
}
