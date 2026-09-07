import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LensFinding } from "@/lib/lenses/types";
import { findNextPriorityFinding } from "@/lib/execution-sprint/next-priority";
import { ExecutionSprintClient } from "./ExecutionSprintClient";
import { ProposedSprintConfirm, type AlternativeFinding } from "./ProposedSprintConfirm";

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
    .select(
      "id, status, payment_status, choice_mode, start_date, target_end_date, signed_off_at, reviewer_commentary, selected_finding_id, report_id, companies(name)",
    )
    .eq("id", sprintId)
    .maybeSingle();

  if (sprintError || !sprint) notFound();

  const company = sprint.companies as unknown as { name: string } | null;

  // Real client confirm-or-reselect step (confirmed 2026-08-18) — the
  // direct closure of the reported gap: a reviewer proposing a sprint
  // used to leave it silently appearing already `in_progress`, with zero
  // client input point. `proposeSprintFinding()` now creates the sprint
  // in this 'proposed' status with no tasks drafted yet — the client must
  // confirm (or reselect from a finding they'd previously marked
  // "interested in help" on for this same report) before any task-
  // scoping work happens.
  if (sprint.status === "proposed") {
    const { data: proposedFindingRow } = await supabase
      .from("lens_findings")
      .select("ai_draft, reviewer_edited_content")
      .eq("id", sprint.selected_finding_id)
      .maybeSingle();
    const proposedContent = (proposedFindingRow?.reviewer_edited_content ?? proposedFindingRow?.ai_draft) as LensFinding | undefined;

    const { data: interestRows } = await supabase
      .from("sprint_interest_requests")
      .select("finding_id, lens_findings(ai_draft, reviewer_edited_content)")
      .eq("report_id", sprint.report_id)
      .eq("response", "interested")
      .neq("finding_id", sprint.selected_finding_id);

    const seen = new Set<string>();
    const alternatives: AlternativeFinding[] = [];
    for (const row of interestRows ?? []) {
      const fid = row.finding_id as string;
      if (seen.has(fid)) continue;
      seen.add(fid);
      const f = row.lens_findings as unknown as { ai_draft: { title?: string } | null; reviewer_edited_content: { title?: string } | null } | null;
      const title = f?.reviewer_edited_content?.title ?? f?.ai_draft?.title;
      if (title) alternatives.push({ id: fid, title });
    }

    return (
      <ProposedSprintConfirm
        sprintId={sprint.id}
        companyName={company?.name ?? "Your company"}
        proposedFinding={{
          id: sprint.selected_finding_id,
          title: proposedContent?.title ?? "Unknown finding",
          diagnosis: proposedContent?.diagnosis ?? "",
        }}
        alternatives={alternatives}
      />
    );
  }

  // Execution Sprint payment gate (confirmed 2026-09-07, unified flow
  // spec) — a real, new branch: confirmSprintFinding()/
  // requestSprintChooseOwnFinding()/requestSprintLetElvanisChoose() all
  // land here now, with no tasks drafted yet (deferred until a reviewer
  // marks this sprint paid). Same "Submitted" vs "Awaiting payment"
  // three-word vocabulary as re-audits/modules.
  if (sprint.status === "awaiting_payment") {
    let findingTitle: string | null = null;
    if (sprint.selected_finding_id) {
      const { data: chosenFinding } = await supabase
        .from("lens_findings")
        .select("ai_draft, reviewer_edited_content")
        .eq("id", sprint.selected_finding_id)
        .maybeSingle();
      const content = (chosenFinding?.reviewer_edited_content ?? chosenFinding?.ai_draft) as LensFinding | undefined;
      findingTitle = content?.title ?? null;
    }
    const isUnpaid = sprint.payment_status === "unpaid";
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold">{isUnpaid ? "Awaiting payment" : "Submitted"}</h1>
        <p className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
          {findingTitle
            ? `Your Execution Sprint on "${findingTitle}" is confirmed.`
            : "Your reviewer will pick the finding this Execution Sprint focuses on."}
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {isUnpaid
            ? "We checked, and this hasn't been marked as paid yet — the plan is on hold until payment is confirmed."
            : "No plan has been drafted yet — that starts once payment is confirmed."}
        </p>
      </div>
    );
  }

  if (sprint.status === "scoped") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold">Your Execution Sprint is being scoped</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Thanks for confirming — your reviewer is now finalizing the plan. We&apos;ll let you know as soon as it&apos;s
          ready.
        </p>
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
    .select("id, task_description, owner, kpi_description, kpi_target_value, kpi_unit, kpi_actual_value, kpi_direction, status, due_date, reviewer_status")
    .eq("execution_sprint_id", sprintId)
    .neq("reviewer_status", "rejected")
    .order("created_at", { ascending: true });
  if (tasksError) throw new Error(`Failed to load tasks: ${tasksError.message}`);

  const { data: queueItems } = await supabase
    .from("sprint_queue_items")
    .select("id, sprint_task_id, trigger_type, note, status, reviewer_reply, created_at")
    .eq("execution_sprint_id", sprintId)
    .order("created_at", { ascending: false });

  // Sprint-completion bridge (confirmed 2026-08-13, direct founder
  // request) — only worth computing once the sprint is actually complete;
  // querying it unconditionally would waste a read on every in-progress
  // page view for data nobody sees yet.
  const nextPriority = sprint.status === "complete" ? await findNextPriorityFinding(supabase, sprint.report_id, sprint.selected_finding_id) : null;

  return (
    <ExecutionSprintClient
      sprintId={sprint.id}
      reportId={sprint.report_id}
      companyName={company?.name ?? "Your company"}
      findingTitle={findingContent?.title ?? "Unknown finding"}
      sprintStatus={sprint.status}
      startDate={sprint.start_date}
      targetEndDate={sprint.target_end_date}
      signedOffAt={sprint.signed_off_at}
      reviewerCommentary={sprint.reviewer_commentary}
      tasks={tasks ?? []}
      queueItems={queueItems ?? []}
      nextPriority={nextPriority}
    />
  );
}
