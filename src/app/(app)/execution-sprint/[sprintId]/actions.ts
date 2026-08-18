"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettingNumber } from "@/lib/app-settings";
import { createSprintQueueItem, confirmSprintFinding } from "@/lib/execution-sprint/workspace";

/**
 * Client-facing Execution Sprint actions (confirmed 2026-08-06). The
 * approved plan is locked — task_description/owner/kpi_target_value/
 * kpi_direction/due_date can NEVER be written here, only status and
 * kpi_actual_value, whitelisted explicitly rather than trusting RLS to
 * enforce it (Postgres RLS is row-level only, it can't enforce "these two
 * columns are editable but these four aren't"). Every action re-verifies
 * company ownership via the session-scoped client first, then performs
 * the actual restricted-field write via the admin client — same
 * session-verify-then-admin-write split already used throughout this
 * codebase (submitEvidence, requestSession, etc.).
 */

interface OwnedSprintTask {
  taskId: string;
  sprintId: string;
  companyId: string;
  kpiTargetValue: number | null;
  kpiDirection: "higher_is_better" | "lower_is_better" | null;
  kpiDescription: string | null;
}

async function verifyOwnedTask(sprintId: string, taskId: string): Promise<OwnedSprintTask> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  // Session-scoped read — RLS already restricts this to the caller's own company's sprints/tasks.
  const { data: sprint, error: sprintError } = await supabase
    .from("execution_sprints")
    .select("id, company_id, status")
    .eq("id", sprintId)
    .single();
  if (sprintError || !sprint) throw new Error("Sprint not found, or you don't have access to it.");

  const { data: task, error: taskError } = await supabase
    .from("sprint_tasks")
    .select("id, execution_sprint_id, kpi_target_value, kpi_direction, kpi_description")
    .eq("id", taskId)
    .eq("execution_sprint_id", sprintId)
    .single();
  if (taskError || !task) throw new Error("Task not found on this sprint.");

  return {
    taskId: task.id as string,
    sprintId: sprint.id as string,
    companyId: sprint.company_id as string,
    kpiTargetValue: task.kpi_target_value as number | null,
    kpiDirection: task.kpi_direction as "higher_is_better" | "lower_is_better" | null,
    kpiDescription: task.kpi_description as string | null,
  };
}

async function touchLastClientActivity(sprintId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("execution_sprints").update({ last_client_activity_at: new Date().toISOString() }).eq("id", sprintId);
}

export async function updateTaskStatusAction(sprintId: string, taskId: string, status: "not_started" | "in_progress" | "done"): Promise<{ success: boolean; error?: string }> {
  try {
    const owned = await verifyOwnedTask(sprintId, taskId);
    const admin = createAdminClient();
    const { error } = await admin.from("sprint_tasks").update({ status }).eq("id", owned.taskId);
    if (error) throw new Error(error.message);
    await touchLastClientActivity(sprintId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/**
 * Deterministic deviation check (confirmed 2026-08-06, "same mechanism as
 * the plan-change notes, different trigger") — never AI-judged. Positive
 * percentDiff means the actual is unfavorably off-target; the sign
 * convention differs by direction so both "higher is better" and "lower
 * is better" KPIs use the same "positive = bad" comparison against the
 * threshold.
 */
function deviationPercent(target: number, actual: number, direction: "higher_is_better" | "lower_is_better"): number | null {
  if (target === 0) return null; // avoid divide-by-zero; not enough signal to judge
  return direction === "higher_is_better" ? ((target - actual) / Math.abs(target)) * 100 : ((actual - target) / Math.abs(target)) * 100;
}

export async function updateKpiActualAction(sprintId: string, taskId: string, kpiActualValue: number): Promise<{ success: boolean; error?: string }> {
  try {
    const owned = await verifyOwnedTask(sprintId, taskId);
    const admin = createAdminClient();
    const { error } = await admin.from("sprint_tasks").update({ kpi_actual_value: kpiActualValue }).eq("id", owned.taskId);
    if (error) throw new Error(error.message);
    await touchLastClientActivity(sprintId);

    if (owned.kpiTargetValue !== null && owned.kpiDirection !== null) {
      const thresholdPercent = await getSettingNumber("kpi_deviation_threshold_percent", 20);
      const deviation = deviationPercent(owned.kpiTargetValue, kpiActualValue, owned.kpiDirection);
      if (deviation !== null && deviation > thresholdPercent) {
        const note = `KPI "${owned.kpiDescription ?? "target"}" deviated ${deviation.toFixed(1)}% from target: actual ${kpiActualValue} vs. target ${owned.kpiTargetValue} (${owned.kpiDirection === "higher_is_better" ? "higher is better" : "lower is better"}).`;
        await createSprintQueueItem(sprintId, owned.taskId, "kpi_deviation", note);
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function submitChangeRequestNoteAction(sprintId: string, taskId: string, note: string): Promise<{ success: boolean; error?: string }> {
  try {
    const owned = await verifyOwnedTask(sprintId, taskId);
    if (!note.trim()) return { success: false, error: "Note can't be empty." };
    await createSprintQueueItem(sprintId, owned.taskId, "client_note", note.trim());
    await touchLastClientActivity(sprintId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/** No auto-complete — the client explicitly signs off. Reviewer is notified to add final commentary. */
export async function signOffSprintAction(sprintId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not signed in." };

    const { data: sprint, error: sprintError } = await supabase.from("execution_sprints").select("id, status").eq("id", sprintId).single();
    if (sprintError || !sprint) return { success: false, error: "Sprint not found, or you don't have access to it." };
    if (sprint.status !== "in_progress") return { success: false, error: "This sprint isn't in progress." };

    const admin = createAdminClient();
    const { error } = await admin
      .from("execution_sprints")
      .update({ status: "complete", signed_off_at: new Date().toISOString() })
      .eq("id", sprintId);
    if (error) throw new Error(error.message);

    const { data: reviewers } = await admin.from("users").select("id").eq("role", "reviewer");
    for (const reviewer of reviewers ?? []) {
      await admin.from("notifications").insert({
        recipient_type: "reviewer",
        recipient_id: reviewer.id,
        event_type: "sprint_signed_off",
        channel: "email",
        sent_at: null,
      });
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/**
 * Real client confirm-or-reselect step (confirmed 2026-08-18) — the
 * direct closure of the reported gap: a client can confirm the reviewer's
 * proposed finding, or choose a different one they'd previously marked
 * "interested in help" on. Session-verified here (RLS-scoped read
 * confirms the caller owns this sprint and it's genuinely still
 * 'proposed'), then the real re-verification and task-drafting happens in
 * confirmSprintFinding() itself — defensive, not just trusted from this
 * layer.
 */
export async function confirmSprintFindingAction(sprintId: string, confirmedFindingId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Not signed in." };

    const { data: sprint, error: sprintError } = await supabase
      .from("execution_sprints")
      .select("id, status")
      .eq("id", sprintId)
      .single();
    if (sprintError || !sprint) return { success: false, error: "Sprint not found, or you don't have access to it." };
    if (sprint.status !== "proposed") return { success: false, error: "This sprint has already been confirmed." };

    await confirmSprintFinding(sprintId, confirmedFindingId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
