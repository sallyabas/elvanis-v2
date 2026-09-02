import { createTestAdminClient } from "./db";
import { freshTestEmail } from "./testEmail";

/**
 * Session-booking-lifecycle fixtures — confirmed 2026-09-03.
 *
 * One real client + company, with a real `sent` report already on file so
 * requestSession()'s own precondition for Delivery Session ("only once you
 * have a delivered report") is genuinely satisfied, not worked around —
 * confirmed by reading requestSession() directly: it only checks for a
 * `reports` row with status='sent' for the company, no findings/lens data
 * needed, so this can be seeded directly without a real Groq run.
 */
export interface SessionLifecycleFixtures {
  clientEmail: string;
  reviewerEmail: string;
  companyName: string;
  companyId: string;
  sentReportId: string;
}

export async function seedSessionLifecycleFixtures(): Promise<SessionLifecycleFixtures> {
  const supabase = createTestAdminClient();

  const clientEmail = freshTestEmail("session-client");
  const reviewerEmail = freshTestEmail("session-reviewer");
  const companyName = `Playwright Session Co ${Date.now()}`;

  const { data: clientAuth, error: clientAuthError } = await supabase.auth.admin.createUser({ email: clientEmail, email_confirm: true });
  if (clientAuthError || !clientAuth.user) throw new Error(`seedSessionLifecycleFixtures: create client auth failed: ${clientAuthError?.message}`);
  const { data: reviewerAuth, error: reviewerAuthError } = await supabase.auth.admin.createUser({ email: reviewerEmail, email_confirm: true });
  if (reviewerAuthError || !reviewerAuth.user) throw new Error(`seedSessionLifecycleFixtures: create reviewer auth failed: ${reviewerAuthError?.message}`);

  await supabase.from("users").upsert({ id: clientAuth.user.id, email: clientEmail, role: "client" }, { onConflict: "id" });
  await supabase.from("users").upsert({ id: reviewerAuth.user.id, email: reviewerEmail, role: "reviewer" }, { onConflict: "id" });

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({ user_id: clientAuth.user.id, name: companyName, privacy_acknowledged_at: new Date().toISOString() })
    .select("id")
    .single();
  if (companyError || !company) throw new Error(`seedSessionLifecycleFixtures: create company failed: ${companyError?.message}`);

  const { data: goal, error: goalError } = await supabase.from("goals").insert({ company_id: company.id, primary_goal: "cash_flow_margin_efficiency" }).select("id").single();
  if (goalError || !goal) throw new Error(`seedSessionLifecycleFixtures: create goal failed: ${goalError?.message}`);

  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .insert({
      company_id: company.id,
      goal_id: goal.id,
      status: "sent",
      submitted_at: past,
      edit_window_closes_at: past,
      reviewed_by: reviewerAuth.user.id,
      approved_at: past,
      delivered_at: past,
      failed_lenses: [],
    })
    .select("id")
    .single();
  if (reportError || !report) throw new Error(`seedSessionLifecycleFixtures: create sent report failed: ${reportError?.message}`);

  return { clientEmail, reviewerEmail, companyName, companyId: company.id as string, sentReportId: report.id as string };
}
