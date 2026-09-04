import { createTestAdminClient } from "./db";
import { freshTestEmail } from "./testEmail";

/**
 * SLA/Overdue-badge fixtures — confirmed 2026-09-03.
 *
 * Reads the REAL configured module_delivery_turnaround_target_hours value
 * from app_settings (falling back to 48 only if the row is ever missing,
 * matching getSettingNumber()'s own fallback) rather than assuming a fixed
 * number — per explicit instruction, since this exact value was the
 * subject of a real, confirmed inconsistency fixed the same day (queue.tsx
 * and dashboard.tsx used to read a different, core-audit-specific number
 * here; both now read this same setting).
 *
 * Seeds two companies:
 * - "overdue" company: one Core Audit report with review_due_at already
 *   in the past, and one module request in pending_review whose created_at
 *   is further back than the real turnaround target — both should show
 *   the Overdue badge, and this is genuinely the first time the module
 *   case does (previously hardcoded false for pending_review modules).
 * - "control" company: one Core Audit report with review_due_at safely in
 *   the future, and one module request created moments ago — neither
 *   should show Overdue, proving the badge isn't just always-on.
 */
export interface SlaFixtures {
  reviewerEmail: string;
  clientEmail: string;
  overdueCompanyName: string;
  controlCompanyName: string;
  overdueReportId: string;
  moduleTurnaroundHours: number;
}

async function readModuleTurnaroundHours(): Promise<number> {
  const supabase = createTestAdminClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "module_delivery_turnaround_target_hours").maybeSingle();
  return typeof data?.value === "number" ? data.value : 48;
}

export async function seedSlaFixtures(): Promise<SlaFixtures> {
  const supabase = createTestAdminClient();
  const moduleTurnaroundHours = await readModuleTurnaroundHours();

  const clientEmail = freshTestEmail("sla-client");
  const reviewerEmail = freshTestEmail("sla-reviewer");
  const overdueCompanyName = `Playwright SLA Overdue Co ${Date.now()}`;
  const controlCompanyName = `Playwright SLA Control Co ${Date.now()}`;

  const { data: clientAuth, error: clientAuthError } = await supabase.auth.admin.createUser({ email: clientEmail, email_confirm: true });
  if (clientAuthError || !clientAuth.user) throw new Error(`seedSlaFixtures: create client auth failed: ${clientAuthError?.message}`);
  const { data: reviewerAuth, error: reviewerAuthError } = await supabase.auth.admin.createUser({ email: reviewerEmail, email_confirm: true });
  if (reviewerAuthError || !reviewerAuth.user) throw new Error(`seedSlaFixtures: create reviewer auth failed: ${reviewerAuthError?.message}`);

  await supabase.from("users").upsert({ id: clientAuth.user.id, email: clientEmail, role: "client" }, { onConflict: "id" });
  await supabase.from("users").upsert({ id: reviewerAuth.user.id, email: reviewerEmail, role: "reviewer" }, { onConflict: "id" });

  const now = Date.now();

  // Real redirect-loop fix (confirmed 2026-09-04, full-platform E2E
  // re-test) — entry_path must be set, or the client-facing half of this
  // fixture (visiting /reports/[id], inside the (app) route group) hits
  // an infinite redirect loop instead of the real holding page under
  // test. See tests/e2e/support/seed.ts's own equivalent fix for the full
  // root-cause writeup.
  const { data: overdueCompany, error: overdueCompanyError } = await supabase
    .from("companies")
    .insert({ user_id: clientAuth.user.id, name: overdueCompanyName, privacy_acknowledged_at: new Date().toISOString(), entry_path: "diagnosis" })
    .select("id")
    .single();
  if (overdueCompanyError || !overdueCompany) throw new Error(`seedSlaFixtures: create overdue company failed: ${overdueCompanyError?.message}`);

  const { data: controlCompany, error: controlCompanyError } = await supabase
    .from("companies")
    .insert({ user_id: reviewerAuth.user.id, name: controlCompanyName, privacy_acknowledged_at: new Date().toISOString(), entry_path: "diagnosis" })
    .select("id")
    .single();
  if (controlCompanyError || !controlCompany) throw new Error(`seedSlaFixtures: create control company failed: ${controlCompanyError?.message}`);
  // Real, deliberate reuse: the control company's own `user_id` doesn't
  // matter for this spec (nobody signs in as its owner) — reusing the
  // reviewer's auth id here avoids creating a third throwaway account
  // purely to satisfy companies.user_id's not-null constraint.

  const { data: overdueGoal } = await supabase.from("goals").insert({ company_id: overdueCompany.id, primary_goal: "cash_flow_margin_efficiency" }).select("id").single();
  const { data: controlGoal } = await supabase.from("goals").insert({ company_id: controlCompany.id, primary_goal: "cash_flow_margin_efficiency" }).select("id").single();

  const past = new Date(now - 60 * 60 * 1000).toISOString(); // 1h ago — edit window closed either way
  const overdueDueAt = new Date(now - 60 * 60 * 1000).toISOString(); // review_due_at 1h in the PAST
  const futureDueAt = new Date(now + 1000 * 60 * 60 * 1000).toISOString(); // review_due_at safely in the future

  const { data: overdueReport, error: overdueReportError } = await supabase
    .from("reports")
    .insert({
      company_id: overdueCompany.id,
      goal_id: overdueGoal!.id,
      status: "pending_review",
      submitted_at: past,
      edit_window_closes_at: past,
      review_due_at: overdueDueAt,
      failed_lenses: [],
    })
    .select("id")
    .single();
  if (overdueReportError || !overdueReport) throw new Error(`seedSlaFixtures: create overdue report failed: ${overdueReportError?.message}`);

  const { error: controlReportError } = await supabase.from("reports").insert({
    company_id: controlCompany.id,
    goal_id: controlGoal!.id,
    status: "pending_review",
    submitted_at: past,
    edit_window_closes_at: past,
    review_due_at: futureDueAt,
    failed_lenses: [],
  });
  if (controlReportError) throw new Error(`seedSlaFixtures: create control report failed: ${controlReportError.message}`);

  // Module created well past the REAL turnaround target — genuinely
  // overdue regardless of what that real value happens to be right now.
  const overdueModuleCreatedAt = new Date(now - (moduleTurnaroundHours + 1) * 60 * 60 * 1000).toISOString();
  // Module created a minute ago — safely NOT overdue against any
  // realistic positive turnaround target.
  const controlModuleCreatedAt = new Date(now - 60 * 1000).toISOString();

  const { error: overdueModuleError } = await supabase
    .from("module_requests")
    .insert({ module_type: "tender_readiness", company_id: overdueCompany.id, status: "pending_review", created_at: overdueModuleCreatedAt, intake_data: {} });
  if (overdueModuleError) throw new Error(`seedSlaFixtures: create overdue module failed: ${overdueModuleError.message}`);

  const { error: controlModuleError } = await supabase
    .from("module_requests")
    .insert({ module_type: "ai_reliability", company_id: controlCompany.id, status: "pending_review", created_at: controlModuleCreatedAt, intake_data: {} });
  if (controlModuleError) throw new Error(`seedSlaFixtures: create control module failed: ${controlModuleError.message}`);

  return { reviewerEmail, clientEmail, overdueCompanyName, controlCompanyName, overdueReportId: overdueReport.id as string, moduleTurnaroundHours };
}
