import { createAdminClient } from "@/lib/supabase/admin";
import { getSettingNumber } from "@/lib/app-settings";

/**
 * Re-audit reminder cadence (confirmed 2026-08-02): 90 days after delivery
 * by default, adjustable via app_settings.re_audit_reminder_days without a
 * redeploy. Recurring, not one-shot — fires again `cadenceDays` after the
 * LAST reminder if the client still hasn't started a new audit cycle, not
 * just once after delivery.
 *
 * A company is due when its most-recently-CREATED report (any status) is
 * `sent` with a `delivered_at` — if a newer report already exists in any
 * other status, they've already started a re-audit and should not be
 * reminded. Idempotent per cadence window via the most recent
 * `re_audit_reminder` notification's timestamp, same as the last delivery
 * if none exists yet.
 */
export interface ReAuditReminderFired {
  companyId: string;
  reportId: string;
}

interface ReportRow {
  id: string;
  company_id: string;
  status: string;
  delivered_at: string | null;
  created_at: string;
  companies: { user_id: string } | { user_id: string }[] | null;
}

export async function checkReAuditReminders(): Promise<ReAuditReminderFired[]> {
  const supabase = createAdminClient();
  const cadenceDays = await getSettingNumber("re_audit_reminder_days", 90);
  const cutoffMs = Date.now() - cadenceDays * 24 * 60 * 60 * 1000;

  const { data: allReports, error } = await supabase
    .from("reports")
    .select("id, company_id, status, delivered_at, created_at, companies(user_id)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`checkReAuditReminders: failed to load reports: ${error.message}`);

  const latestByCompany = new Map<string, ReportRow>();
  for (const r of (allReports ?? []) as ReportRow[]) {
    if (!latestByCompany.has(r.company_id)) latestByCompany.set(r.company_id, r);
  }

  const fired: ReAuditReminderFired[] = [];

  for (const report of latestByCompany.values()) {
    if (report.status !== "sent" || !report.delivered_at) continue;

    const company = Array.isArray(report.companies) ? report.companies[0] : report.companies;
    if (!company) continue;

    const { data: lastReminder } = await supabase
      .from("notifications")
      .select("created_at")
      .eq("recipient_type", "client")
      .eq("recipient_id", company.user_id)
      .eq("event_type", "re_audit_reminder")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sinceMs = new Date(lastReminder?.created_at ?? report.delivered_at).getTime();
    if (sinceMs > cutoffMs) continue;

    const { error: insertError } = await supabase.from("notifications").insert({
      recipient_type: "client",
      recipient_id: company.user_id,
      event_type: "re_audit_reminder",
      channel: "email",
      sent_at: null, // logged, not delivered — real send is a separate, explicit step
    });
    if (insertError) throw new Error(`checkReAuditReminders: failed to log notification: ${insertError.message}`);

    fired.push({ companyId: report.company_id, reportId: report.id });
  }

  return fired;
}
