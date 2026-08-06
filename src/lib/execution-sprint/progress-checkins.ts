import { createAdminClient } from "@/lib/supabase/admin";
import { getSettingNumber } from "@/lib/app-settings";

/**
 * Execution Sprint progress check-in reminders (confirmed 2026-08-06) —
 * "if the client goes quiet, send a reminder... never auto-close." Reuses
 * the dormant `sprint_progress_checkin` scheduled_jobs job_type concept and
 * the `sprint_update` notification_event_type (both existed in schema,
 * unused, since the original migration — same "activate what's already
 * there" precedent as re_audit_reminder/evidence_completeness_nudge).
 *
 * "Quiet" is measured from `last_client_activity_at` (touched by every
 * client-facing sprint action — status updates, KPI actuals, change-request
 * notes), falling back to `start_date` when the client has never touched
 * the sprint at all. Recurring, not one-shot, and idempotent per cadence
 * window via the most recent `sprint_update` notification for that
 * company — same pattern as checkReAuditReminders.
 */
export interface SprintCheckinFired {
  companyId: string;
  sprintId: string;
}

interface SprintRow {
  id: string;
  company_id: string;
  status: string;
  start_date: string | null;
  last_client_activity_at: string | null;
  companies: { user_id: string } | { user_id: string }[] | null;
}

export async function checkSprintProgressCheckins(): Promise<SprintCheckinFired[]> {
  const supabase = createAdminClient();
  const cadenceDays = await getSettingNumber("sprint_progress_checkin_days", 7);
  const cutoffMs = Date.now() - cadenceDays * 24 * 60 * 60 * 1000;

  const { data: sprints, error } = await supabase
    .from("execution_sprints")
    .select("id, company_id, status, start_date, last_client_activity_at, companies(user_id)")
    .eq("status", "in_progress");
  if (error) throw new Error(`checkSprintProgressCheckins: failed to load sprints: ${error.message}`);

  const fired: SprintCheckinFired[] = [];

  for (const sprint of (sprints ?? []) as SprintRow[]) {
    const company = Array.isArray(sprint.companies) ? sprint.companies[0] : sprint.companies;
    if (!company) continue;

    const lastActivityMs = new Date(sprint.last_client_activity_at ?? sprint.start_date ?? Date.now()).getTime();
    if (lastActivityMs > cutoffMs) continue;

    const { data: lastReminder } = await supabase
      .from("notifications")
      .select("created_at")
      .eq("recipient_type", "client")
      .eq("recipient_id", company.user_id)
      .eq("event_type", "sprint_update")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sinceMs = new Date(lastReminder?.created_at ?? sprint.start_date ?? lastActivityMs).getTime();
    if (sinceMs > cutoffMs) continue;

    const { error: insertError } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: company.user_id,
      event_type: "sprint_update",
      channel: "email",
      sent_at: null,
    });
    if (insertError) throw new Error(`checkSprintProgressCheckins: failed to log notification: ${insertError.message}`);

    fired.push({ companyId: sprint.company_id, sprintId: sprint.id });
  }

  return fired;
}
