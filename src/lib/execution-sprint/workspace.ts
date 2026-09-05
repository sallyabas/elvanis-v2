import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications/send-email";
import { renderEmail } from "@/lib/notifications/email-template";
import { isOptedOut, type NotificationPreferences } from "@/lib/notifications/preferences";
import { draftSprintTasks } from "./draft-tasks";
import { loadCompanyProfileForLens, loadGoalContext } from "@/lib/audit/load-profile";
import type { LensFinding } from "@/lib/lenses/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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

export interface ProposeSprintResult {
  sprintId: string;
}

/**
 * Real gap found and closed (confirmed 2026-08-18, direct founder
 * question): "does the client see any confirmation step before a Sprint
 * formally begins, or does it just appear already started?" Investigated
 * before building anything — confirmed the answer was genuinely no
 * confirmation step existed anywhere, not even a notification. This
 * function is the first of the two-step replacement for what used to be
 * createSprintFromFinding()'s single step: the reviewer proposes ONE
 * finding (still their call, not opened up to a free client choice), but
 * task-drafting no longer happens yet — that's confirmSprintFinding()
 * below, which only runs once the client has actually confirmed (or
 * reselected) which finding the sprint should address. Same "no in-app
 * checkout, payment confirmed externally first" pattern as before.
 */
export async function proposeSprintFinding(reportId: string, findingId: string): Promise<ProposeSprintResult> {
  const supabase = createAdminClient();

  const { data: findingRow, error: findingError } = await supabase
    .from("lens_findings")
    .select("id, report_id, reviewer_status")
    .eq("id", findingId)
    .single();
  if (findingError || !findingRow) throw new Error(`proposeSprintFinding: finding not found: ${findingError?.message}`);
  if (findingRow.report_id !== reportId) throw new Error("proposeSprintFinding: finding does not belong to this report");
  if (findingRow.reviewer_status !== "approved" && findingRow.reviewer_status !== "edited") {
    throw new Error("proposeSprintFinding: only a reviewer-approved or reviewer-edited finding can seed an Execution Sprint");
  }

  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("company_id, status, companies(user_id)")
    .eq("id", reportId)
    .single();
  if (reportError || !report) throw new Error(`proposeSprintFinding: report not found: ${reportError?.message}`);
  if (report.status !== "approved" && report.status !== "sent") {
    throw new Error(`proposeSprintFinding: report must be approved or delivered first (current status: ${report.status})`);
  }

  const { data: sprintRow, error: sprintError } = await supabase
    .from("execution_sprints")
    .insert({ company_id: report.company_id, report_id: reportId, selected_finding_id: findingId, status: "proposed" })
    .select("id")
    .single();
  if (sprintError || !sprintRow) throw new Error(`proposeSprintFinding: failed to create sprint: ${sprintError?.message}`);

  // Real, client-facing notification — the exact thing that was missing
  // before this fix. Logged now, actually sent on the next dispatch pass,
  // same "log now, send explicitly" pattern as every other notification-
  // creating function in this codebase.
  const owner = report.companies as unknown as { user_id: string } | null;
  if (owner?.user_id) {
    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: owner.user_id,
      event_type: "sprint_proposed",
      channel: "email",
      sent_at: null,
      related_sprint_id: sprintRow.id,
    });
    if (notifError) throw new Error(`proposeSprintFinding: failed to log notification: ${notifError.message}`);
  }

  return { sprintId: sprintRow.id as string };
}

/**
 * The real confirm-or-reselect step (confirmed 2026-08-18) — runs the
 * task-drafting work that used to happen immediately inside
 * createSprintFromFinding(), but only now, once the client has actually
 * confirmed which finding the sprint should address. `confirmedFindingId`
 * must be either the reviewer's originally-proposed finding, or a finding
 * the client had previously marked "interested in help" on for the SAME
 * report (via sprint_interest_requests) — this isn't opened up to a free
 * choice from scratch, the client is choosing among findings they've
 * already flagged real interest in, or sticking with the reviewer's own
 * pick. Re-verified here defensively (not just trusted from the caller),
 * since this function's caller is a client-facing Server Action. The
 * reviewer still does the actual task-scoping work (Accept/Edit/Reject)
 * from here via the existing mandatory gate — this only decides WHICH
 * finding gets scoped, never skips that review pass.
 */
export async function confirmSprintFinding(sprintId: string, confirmedFindingId: string): Promise<CreateSprintResult> {
  const supabase = createAdminClient();

  const { data: sprint, error: sprintError } = await supabase
    .from("execution_sprints")
    .select("id, report_id, company_id, status, selected_finding_id")
    .eq("id", sprintId)
    .single();
  if (sprintError || !sprint) throw new Error(`confirmSprintFinding: sprint not found: ${sprintError?.message}`);
  if (sprint.status !== "proposed") {
    throw new Error(`confirmSprintFinding: sprint must be in 'proposed' status (current status: ${sprint.status})`);
  }

  if (confirmedFindingId !== sprint.selected_finding_id) {
    const { data: interestRow } = await supabase
      .from("sprint_interest_requests")
      .select("id")
      .eq("company_id", sprint.company_id)
      .eq("report_id", sprint.report_id)
      .eq("finding_id", confirmedFindingId)
      .eq("response", "interested")
      .maybeSingle();
    if (!interestRow) {
      throw new Error("confirmSprintFinding: the chosen finding must be one you'd previously marked 'interested in help' on");
    }
  }

  const { data: findingRow, error: findingError } = await supabase
    .from("lens_findings")
    .select("id, report_id, reviewer_status, ai_draft, reviewer_edited_content")
    .eq("id", confirmedFindingId)
    .single();
  if (findingError || !findingRow) throw new Error(`confirmSprintFinding: finding not found: ${findingError?.message}`);
  if (findingRow.report_id !== sprint.report_id) throw new Error("confirmSprintFinding: finding does not belong to this sprint's report");
  if (findingRow.reviewer_status !== "approved" && findingRow.reviewer_status !== "edited") {
    throw new Error("confirmSprintFinding: only a reviewer-approved or reviewer-edited finding can be selected");
  }
  const finding = (findingRow.reviewer_edited_content ?? findingRow.ai_draft) as LensFinding;

  const { data: reportRow, error: reportRowError } = await supabase.from("reports").select("goal_id").eq("id", sprint.report_id).single();
  if (reportRowError || !reportRow) throw new Error(`confirmSprintFinding: report not found: ${reportRowError?.message}`);

  const companyProfile = await loadCompanyProfileForLens(supabase, sprint.company_id as string);
  const goalContext = await loadGoalContext(supabase, reportRow.goal_id as string);

  const draftedTasks = await draftSprintTasks(finding, companyProfile, goalContext);

  const taskRows = draftedTasks.map((t) => ({
    execution_sprint_id: sprintId,
    task_description: t.taskDescription,
    owner: t.ownerRoleLabel,
    kpi_description: t.kpiDescription,
    kpi_target_value: t.kpiTargetValue,
    kpi_unit: t.kpiUnit,
    kpi_actual_value: null,
    kpi_direction: t.kpiDirection,
    due_date: null, // computed at approveSprintTasks() once the sprint's start_date is known
    status: "not_started",
    ai_draft: t,
    reviewer_status: "draft",
  }));

  const { error: tasksError } = await supabase.from("sprint_tasks").insert(taskRows);
  if (tasksError) throw new Error(`confirmSprintFinding: failed to persist drafted tasks: ${tasksError.message}`);

  const { error: updateError } = await supabase
    .from("execution_sprints")
    .update({ selected_finding_id: confirmedFindingId, confirmed_at: new Date().toISOString(), status: "scoped" })
    .eq("id", sprintId);
  if (updateError) throw new Error(`confirmSprintFinding: failed to update sprint: ${updateError.message}`);

  return { sprintId, taskCount: taskRows.length };
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
  kpiUnit?: string;
  kpiDirection?: "higher_is_better" | "lower_is_better";
}

export async function editSprintTask(taskId: string, edits: SprintTaskEdit): Promise<void> {
  const supabase = createAdminClient();
  const update: Record<string, unknown> = { reviewer_status: "edited" };
  if (edits.taskDescription !== undefined) update.task_description = edits.taskDescription;
  if (edits.owner !== undefined) update.owner = edits.owner;
  if (edits.kpiDescription !== undefined) update.kpi_description = edits.kpiDescription;
  if (edits.kpiTargetValue !== undefined) update.kpi_target_value = edits.kpiTargetValue;
  if (edits.kpiUnit !== undefined) update.kpi_unit = edits.kpiUnit;
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

  // Real perf fix (confirmed 2026-09-05, code-quality audit) — batched
  // insert instead of one per reviewer.
  const { data: reviewers } = await supabase.from("users").select("id").eq("role", "reviewer");
  if ((reviewers ?? []).length > 0) {
    await supabase.from("notifications").insert(
      (reviewers ?? []).map((reviewer) => ({
        recipient_type: "reviewer",
        recipient_id: reviewer.id,
        event_type: "sprint_queue_item",
        channel: "email",
        sent_at: null,
      })),
    );
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

export interface SprintListRow {
  id: string;
  companyName: string;
  status: "proposed" | "scoped" | "in_progress" | "complete";
  findingTitle: string | null;
  targetEndDate: string | null;
  createdAt: string | null;
}

/**
 * Real gap found and fixed (confirmed 2026-08-11, live testing pass) —
 * there was previously no way to see every Execution Sprint regardless of
 * status; the queue's own sprint sections only ever surfaced sprints that
 * either needed a reviewer decision (still 'scoped') or had an open
 * change-request/KPI-deviation note. A sprint with neither — genuinely
 * healthy and in progress, or already complete — was invisible on this
 * page entirely. Same "full directory, not just an action queue" pattern
 * as the "Ready for review" section.
 */
export async function listAllSprints(): Promise<SprintListRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("execution_sprints")
    .select("id, status, target_end_date, created_at, companies(name), lens_findings(ai_draft, reviewer_edited_content)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listAllSprints: ${error.message}`);

  return (data ?? []).map((row) => {
    const company = row.companies as unknown as { name: string } | null;
    const finding = row.lens_findings as unknown as { ai_draft: { title?: string } | null; reviewer_edited_content: { title?: string } | null } | null;
    return {
      id: row.id as string,
      companyName: company?.name ?? "Unknown company",
      status: row.status as "proposed" | "scoped" | "in_progress" | "complete",
      findingTitle: finding?.reviewer_edited_content?.title ?? finding?.ai_draft?.title ?? null,
      targetEndDate: row.target_end_date as string | null,
      createdAt: row.created_at as string | null,
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

  // Preference/opt-out check + shared branded shell (confirmed
  // 2026-09-03, email redesign brief) — a real, previously-missing gap:
  // this immediate-send path bypassed BOTH the shared visual shell AND
  // dispatch.ts's own preference check entirely, meaning a client who'd
  // opted out of "sprintReply" (or unsubscribed from everything) still
  // got emailed here regardless. Fixed without touching the one thing
  // that's genuinely deliberate about this path — the immediate send
  // itself (see this function's own docblock for why that stays).
  const { data: user } = await supabase.from("users").select("email, notification_preferences").eq("id", company.user_id).single();
  if (user?.email) {
    const preferences = (user.notification_preferences as Partial<NotificationPreferences>) ?? {};
    if (isOptedOut(preferences, "sprintReply")) {
      // Opted out — still stamp sent_at (a deliberate skip, not a
      // delivery failure to retry via the cron's fallback template).
      await supabase.from("notifications").update({ sent_at: new Date().toISOString() }).eq("id", notif.id as string);
    } else {
      const html = renderEmail({
        bodyHtml: `<p style="margin:0 0 16px 0;">Your reviewer replied to your Execution Sprint note:</p><p style="margin:0;padding:12px 16px;background:#F1EFE8;border-radius:6px;">${escapeHtml(replyText)}</p><p style="margin:20px 0 0 0;font-size:13px;color:#6b6b69;">Sign in at <a href="${SITE_URL}/client-login" style="color:#6b6b69;">${SITE_URL}/client-login</a> with this same email — this app is passwordless, we'll send you a fresh sign-in link and code.</p>`,
        recipientEmail: user.email as string,
        siteUrl: SITE_URL,
        unsubscribe: { recipientId: company.user_id as string, preferenceKey: "sprintReply" },
      });
      await sendEmail({
        to: user.email as string,
        subject: "Reply to your Execution Sprint question",
        html,
      });
      await supabase.from("notifications").update({ sent_at: new Date().toISOString() }).eq("id", notif.id as string);
    }
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
