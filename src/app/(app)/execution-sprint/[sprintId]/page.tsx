import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LensFinding } from "@/lib/lenses/types";
import { ExecutionSprintClient } from "./ExecutionSprintClient";

/**
 * Client-facing Execution Sprint page (confirmed 2026-08-06) — the
 * approved plan (task description/owner/KPI target/due date) is read-only
 * here by design; status and KPI actuals are the only editable fields
 * (enforced server-side in actions.ts, not just by hiding inputs in this
 * UI). Session-scoped throughout — RLS already restricts execution_sprints/
 * sprint_tasks/sprint_queue_items to the caller's own company.
 */
export default async function ExecutionSprintPage({ params }: { params: Promise<{ sprintId: string }> }) {
  const { sprintId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: sprint, error: sprintError } = await supabase
    .from("execution_sprints")
    .select("id, status, start_date, target_end_date, signed_off_at, reviewer_commentary, selected_finding_id, companies(name)")
    .eq("id", sprintId)
    .maybeSingle();

  if (sprintError || !sprint) notFound();

  if (sprint.status === "scoped") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold">Your Execution Sprint is being scoped</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">We&apos;ll let you know as soon as the plan is ready.</p>
      </div>
    );
  }

  const { data: finding } = await supabase
    .from("lens_findings")
    .select("ai_draft, reviewer_edited_content")
    .eq("id", sprint.selected_finding_id)
    .maybeSingle();
  const findingContent = (finding?.reviewer_edited_content ?? finding?.ai_draft) as LensFinding | undefined;

  const { data: tasks, error: tasksError } = await supabase
    .from("sprint_tasks")
    .select("id, task_description, owner, kpi_description, kpi_target_value, kpi_actual_value, kpi_direction, status, due_date, reviewer_status")
    .eq("execution_sprint_id", sprintId)
    .neq("reviewer_status", "rejected")
    .order("created_at", { ascending: true });
  if (tasksError) throw new Error(`Failed to load tasks: ${tasksError.message}`);

  const { data: queueItems } = await supabase
    .from("sprint_queue_items")
    .select("id, sprint_task_id, trigger_type, note, status, reviewer_reply, created_at")
    .eq("execution_sprint_id", sprintId)
    .order("created_at", { ascending: false });

  const company = sprint.companies as unknown as { name: string } | null;

  return (
    <ExecutionSprintClient
      sprintId={sprint.id}
      companyName={company?.name ?? "Your company"}
      findingTitle={findingContent?.title ?? "Unknown finding"}
      sprintStatus={sprint.status}
      startDate={sprint.start_date}
      targetEndDate={sprint.target_end_date}
      signedOffAt={sprint.signed_off_at}
      reviewerCommentary={sprint.reviewer_commentary}
      tasks={tasks ?? []}
      queueItems={queueItems ?? []}
    />
  );
}
