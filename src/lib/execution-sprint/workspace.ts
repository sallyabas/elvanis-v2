import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/send-email";
import { draftSprintTasks } from "./draft-tasks";
import type { CompanyProfileForLens, GoalContext, LensFinding } from "@/lib/lenses/types";

/**
 * Execution Sprint reviewer workspace (confirmed 2026-08-06) — the paid
 * £3,000 implementation engagement: a bounded 2-4 week effort to fix ONE
 * specific finding from an approved audit. Mirrors the same review
 * mechanism (Accept/Edit/Reject, mandatory gate) already proven for
 * module_findings, but sprint_tasks stores each task as flat scalar
 * columns (task_description/owner/kpi_*) rather than a single JSON blob —
 * `ai_draft` jsonb holds the immutable original AI proposal for audit
 * purposes; the "edit" action updates the live scalar columns directly,
 * consistent with the confirmed design that the reviewer edits the actual
 * record, not a separate overlay.
 */

const MAX_SPRINT_DAYS = 28;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Sprint creation ─────────────────────────────────────────────────────

export interface CreateSprintResult {
  sprintId: string;
  taskCount: number;
}

/**
 * Reviewer-triggered from an approved report's finding (confirmed
 * 2026-08-06) — no in-app checkout exists anywhere in this codebase,
 * payment is confirmed externally first, same pattern already used for
 * Concierge/F2F Workshop. Loads the CURRENT company/goal profile, never a
 * cached copy (same "living record" principle as every lens call), then
 * calls the AI drafter and persists tasks in `draft` status — nothing is
 * client-visible until the reviewer's Accept/Edit/Reject pass clears the
 * mandatory gate (approveSprintTasks below).
 */
export async function createSprintFromFinding(reportId: string, findingId: string): Promise<CreateSprintResult> {
  const supabase = createAdminClient();

  const { data: findingRow, error: findingError } = await supabase
    .from("lens_findings")
    .select("id, report_id, reviewer_status, ai_draft, reviewer_edited_content")
    .eq("id", findingId)
    .single();
  if (findingError || !findingRow) throw new Error(`createSprintFromFinding: finding not found: ${findingError?.message}`);
  if (findingRow.report_id !== reportId) throw new Error("createSprintFromFinding: finding does not belong to this report");
  if (findingRow.reviewer_status !== "approved" && findingRow.reviewer_status !== "edited") {
    throw new Error("createSprintFromFinding: only a reviewer-approved or reviewer-edited finding can seed an Execution Sprint");
  }
  const finding = (findingRow.reviewer_edited_content ?? findingRow.ai_draft) as LensFinding;

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("company_id, goal_id, status")
    .eq("id", reportId)
    .single();
  if (reportError || !report) throw new Error(`createSprintFromFinding: report not found: ${reportError?.message}`);
  if (report.status !== "approved" && report.status !== "sent") {
    throw new Error(`createSprintFromFinding: report must be approved or delivered first (current status: ${report.status})`);
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, name, industry, business_model, registration_country, customer_market_countries, employee_count, stage, revenue_range_band, customer_type, main_tools_stack, team_structure_summary")
    .eq("id", report.company_id)
    .single();
  if (companyError || !company) throw new Error(`createSprintFromFinding: company not found: ${companyError?.message}`);

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("primary_goal, secondary_goal, urgency_level, target_metric, time_horizon, success_definition, desired_future_state_primary, desired_future_state_secondary")
    .eq("id", report.goal_id)
    .single();
  if (goalError || !goal) throw new Error(`createSprintFromFinding: goal not found: ${goalError?.message}`);

  const companyProfile: CompanyProfileForLens = {
    name: company.name as string,
    industry: company.industry as string | null,
    businessModel: company.business_model as "B2B" | "B2C" | null,
    registrationCountry: company.registration_country as string | null,
    customerMarketCountries: (company.customer_market_countries as string[]) ?? [],
    employeeCount: company.employee_count as number | null,
    stage: company.stage as string | null,
    revenueRangeBand: company.revenue_range_band as string | null,
    customerType: company.customer_type as string | null,
    mainToolsStack: company.main_tools_stack as Record<string, unknown> | null,
    teamStructureSummary: company.team_structure_summary as string | null,
  };

  const goalContext: GoalContext = {
    primaryGoal: goal.primary_goal,
    secondaryGoal: goal.secondary_goal,
    urgencyLevel: goal.urgency_level,
    targetMetric: goal.target_metric,
    timeHorizon: goal.time_horizon,
    successDefinition: goal.success_definition,
    desiredFutureStatePrimary: goal.desired_future_state_primary,
    desiredFutureStateSecondary: goal.desired_future_state_secondary,
  };

  const { data: sprintRow, error: sprintError } = await supabase
    .from("execution_sprints")
    .insert({ company_id: report.company_id, report_id: reportId, selected_finding_id: findingId, status: "scoped" })
    .select("id")
    .single();
  if (sprintError || !sprintRow) throw new Error(`createSprintFromFinding: failed to create sprint: ${sprintError?.message}`);

  const draftedTasks = await draftSprintTasks(finding, companyProfile, goalContext);

  const taskRows = draftedTasks.map((t) => ({
    execution_sprint_id: sprintRow.id,
    task_description: t.taskDescription,
    owner: t.ownerRoleLabel,
    kpi_description: t.kpiDescription,
    kpi_target_value: t.kpiTargetValue,
    kpi_actual_value: null,
    kpi_direction: t.kpiDirection,
    due_date: null, // computed at approveSprintTasks() once the sprint's start_date is known
    status: "not_started",
    ai_draft: t,
    reviewer_status: "draft",
  }));

  const { error: tasksError } = await supabase.from("sprint_tasks").insert(taskRows);
  if (tasksError) throw new Error(`createSprintFromFinding: failed to persist drafted tasks: ${tasksError.message}`);

  return { sprintId: sprintRow.id as string, taskCount: taskRows.length };
}

// ── Per-task review (Accept/Edit/Reject) ────────────────────────────────

export async function acceptSprintTask(taskId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("sprint_tasks").update({ reviewer_status: "approved" }).eq("id", taskId);
  if (error) throw new Error(`acceptSprintTask failed: ${error.message}`);
}

export interface SprintTaskEdit {
  taskDescription?: string;
  owner?: string;
  kpiDescription?: string;
  kpiTargetValue?: number;
  kpiDirection?: "higher_is_better" | "lower_is_better";
}

export async function editSprintTask(taskId: string, edits: SprintTaskEdit): Promise<void> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = { reviewer_status: "edited" };
  if (edits.taskDescription !== undefined) update.task_description = edits.taskDescription;
  if (edits.owner !== undefined) update.owner = edits.owner;
  if (edits.kpiDescription !== undefined) update.kpi_description = edits.kpiDescription;
  if (edits.kpiTargetValue !== undefined) update.kpi_target_value = edits.kpiTargetValue;
  if (edits.kpiDirection !== undefined) update.kpi_direction = edits.kpiDirection;

  const { error } = await supabase.from("sprint_tasks").update(update).eq("id", taskId);
  if (error) throw new Error(`editSprintTask failed: ${error.message}`);
}

export async function rejectSprintTask(taskId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("sprint_tasks").update({ reviewer_status: "rejected" }).eq("id", taskId);
  if (error) throw new Error(`rejectSprintTask failed: ${error.message}`);
}

// ── Mandatory gate: approve the sprint plan (scoped -> in_progress) ─────

export interface ApproveSprintResult {
  approved: boolean;
  blockedReason?: string;
}

/**
 * Same mandatory-gate discipline as approveReport()/approveModuleRequest()
 * — blocked, not just discouraged, until every drafted task has a
 * disposition. On success, stamps start_date = now and computes each
 * approved/edited task's due_date from its own ai_draft.suggestedDueDaysFromStart
 * (preserved even if the reviewer edited other fields) — the clock starts
 * once the plan is actually approved and about to become client-visible,
 * not during the reviewer's private review window.
 */
export async function approveSprintTasks(sprintId: string): Promise<ApproveSprintResult> {
  const supabase = createAdminClient();

  const { data: tasks, error: tasksError } = await supabase
    .from("sprint_tasks")
    .select("id, reviewer_status, ai_draft")
    .eq("execution_sprint_id", sprintId);
  if (tasksError) throw new Error(`approveSprintTasks: failed to load tasks: ${tasksError.message}`);

  const undecided = (tasks ?? []).filter((t) => t.reviewer_status === "draft");
  if (undecided.length > 0) {
    return {
      approved: false,
      blockedReason: `${undecided.length} task(s) still need a disposition (accept/edit/reject) before this sprint can start`,
    };
  }

  const startDate = new Date();
  const startDateIso = startDate.toISOString().slice(0, 10);
  const targetEndDate = new Date(startDate.getTime() + MAX_SPRINT_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  for (const task of tasks ?? []) {
    if (task.reviewer_status === "rejected") continue;
    const draft = task.ai_draft as { suggestedDueDaysFromStart?: number } | null;
    const offsetDays = draft?.suggestedDueDaysFromStart ?? MAX_SPRINT_DAYS;
    const dueDate = new Date(startDate.getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await supabase.from("sprint_tasks").update({ due_date: dueDate }).eq("id", task.id);
  }

  const { error: updateError } = await supabase
    .from("execution_sprints")
    .update({ status: "in_progress", start_date: startDateIso, target_end_date: targetEndDate })
    .eq("id", sprintId);
  if (updateError) throw new Error(`approveSprintTasks failed: ${updateError.message}`);

  return { approved: true };
}

// ── Queue items (client change-request notes + KPI-deviation alerts) ────

/**
 * Shared by the client-facing "request a change" note action and the
 * deterministic KPI-deviation check (client-actions.ts) — "same mechanism,
 * different trigger" per the confirmed design. Notifies every reviewer,
 * same pattern as session-requests.ts.
 */
export async function createSprintQueueItem(
  executionSprintId: string,
  sprintTaskId: string | null,
  triggerType: "client_note" | "kpi_deviation",
  note: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error: insertError } = await supabase.from("sprint_queue_items").insert({
    execution_sprint_id: executionSprintId,
    sprint_task_id: sprintTaskId,
    trigger_type: triggerType,
    note,
  });
  if (insertError) throw new Error(`createSprintQueueItem: failed to insert: ${insertError.message}`);

  const { data: reviewers } = await supabase.from("users").select("id").eq("role", "reviewer");
  for (const reviewer of reviewers ?? []) {
    await supabase.from("notifications").insert({
      recipient_type: "reviewer",
      recipient_id: reviewer.id,
      event_type: "sprint_queue_item",
      channel: "email",
      sent_at: null,
    });
  }
}

export interface SprintQueueItemRow {
  id: string;
  execution_sprint_id: string;
  sprint_task_id: string | null;
  trigger_type: "client_note" | "kpi_deviation";
  note: string | null;
  status: "open" | "resolved";
  reviewer_reply: string | null;
  created_at: string;
}

export async function listOpenSprintQueueItems(): Promise<(SprintQueueItemRow & { companyName: string; sprintId: string })[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sprint_queue_items")
    .select("*, execution_sprints(id, companies(name))")
    .eq("status", "open")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listOpenSprintQueueItems: ${error.message}`);

  return (data ?? []).map((row) => {
    const sprint = row.execution_sprints as unknown as { id: string; companies: { name: string } | null } | null;
    return {
      ...(row as unknown as SprintQueueItemRow),
      companyName: sprint?.companies?.name ?? "Unknown company",
      sprintId: sprint?.id ?? "",
    };
  });
}

/**
 * Immediate send (confirmed 2026-08-06) — the one case in this codebase
 * where the standard "log a notifications row, actual send happens on the
 * next cron dispatch tick" pattern is deliberately NOT used. A client
 * waiting on a reply about a struggling KPI shouldn't wait up to 15
 * minutes for the cron to pick it up. Still logs a notifications row for
 * audit-trail consistency with every other event type — just stamps
 * sent_at immediately instead of leaving it null.
 */
export async function replyToSprintQueueItem(queueItemId: string, replyText: string, reviewerId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: item, error: itemError } = await supabase
    .from("sprint_queue_items")
    .select("id, execution_sprint_id")
    .eq("id", queueItemId)
    .single();
  if (itemError || !item) throw new Error(`replyToSprintQueueItem: queue item not found: ${itemError?.message}`);

  const { data: sprint, error: sprintError } = await supabase
    .from("execution_sprints")
    .select("company_id")
    .eq("id", item.execution_sprint_id)
    .single();
  if (sprintError || !sprint) throw new Error(`replyToSprintQueueItem: sprint not found: ${sprintError?.message}`);

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("user_id")
    .eq("id", sprint.company_id)
    .single();
  if (companyError || !company) throw new Error(`replyToSprintQueueItem: company not found: ${companyError?.message}`);

  const { error: updateError } = await supabase
    .from("sprint_queue_items")
    .update({ status: "resolved", reviewer_reply: replyText, resolved_by: reviewerId, resolved_at: new Date().toISOString() })
    .eq("id", queueItemId);
  if (updateError) throw new Error(`replyToSprintQueueItem: failed to resolve: ${updateError.message}`);

  const { data: notif, error: notifError } = await supabase
    .from("notifications")
    .insert({ recipient_type: "client", recipient_id: company.user_id, event_type: "sprint_reply", channel: "email", sent_at: null })
    .select("id")
    .single();
  if (notifError) throw new Error(`replyToSprintQueueItem: failed to log notification: ${notifError.message}`);

  const { data: user } = await supabase.from("users").select("email").eq("id", company.user_id).single();
  if (user?.email) {
    await sendEmail({
      to: user.email as string,
      subject: "Reply to your Execution Sprint question",
      html: `<p>${escapeHtml(replyText)}</p>`,
    });
    await supabase.from("notifications").update({ sent_at: new Date().toISOString() }).eq("id", notif.id as string);
  }
}

// ── Signoff + final commentary ──────────────────────────────────────────

/** Reviewer-facing — only callable once the client has signed off (signed_off_at set by the client action, client-actions.ts). */
export async function addSprintReviewerCommentary(sprintId: string, commentary: string): Promise<void> {
  const supabase = createAdminClient();
  const { data: sprint, error: sprintError } = await supabase.from("execution_sprints").select("signed_off_at").eq("id", sprintId).single();
  if (sprintError || !sprint) throw new Error(`addSprintReviewerCommentary: sprint not found: ${sprintError?.message}`);
  if (!sprint.signed_off_at) throw new Error("addSprintReviewerCommentary: the client hasn't signed off on this sprint yet");

  const { error } = await supabase.from("execution_sprints").update({ reviewer_commentary: commentary }).eq("id", sprintId);
  if (error) throw new Error(`addSprintReviewerCommentary failed: ${error.message}`);
}
