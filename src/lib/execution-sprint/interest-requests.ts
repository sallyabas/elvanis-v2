"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Client-facing Execution Sprint interest (confirmed 2026-08-06, honest UX
 * review pass) — see sprint_interest_requests migration docblock for why
 * this is deliberately not folded into session_requests. Sprint creation
 * itself stays reviewer-triggered; this is only the client's visible path
 * to signal "I want help with this" on a specific finding.
 */

export interface RequestSprintInterestResult {
  success: boolean;
  error?: string;
}

/** Client-facing — session-scoped, RLS-respecting, verifies the caller owns the company and the finding belongs to the given report before writing. */
export async function requestSprintInterest(
  companyId: string,
  reportId: string,
  findingId: string,
  clientNotes: string | null,
): Promise<RequestSprintInterestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: company, error: companyError } = await supabase.from("companies").select("id").eq("id", companyId).eq("user_id", user.id).single();
  if (companyError || !company) return { success: false, error: "Company not found." };

  const { data: finding, error: findingError } = await supabase.from("lens_findings").select("id, report_id").eq("id", findingId).single();
  if (findingError || !finding || finding.report_id !== reportId) return { success: false, error: "Finding not found on this report." };

  const { error: insertError } = await supabase.from("sprint_interest_requests").insert({
    company_id: companyId,
    report_id: reportId,
    finding_id: findingId,
    client_notes: clientNotes,
  });
  if (insertError) return { success: false, error: `Couldn't submit request: ${insertError.message}` };

  // Notify every reviewer, same pattern as session_requests/sprint_queue_items.
  const admin = createAdminClient();
  const { data: reviewers } = await admin.from("users").select("id").eq("role", "reviewer");
  for (const reviewer of reviewers ?? []) {
    await admin.from("notifications").insert({
      recipient_type: "reviewer",
      recipient_id: reviewer.id,
      event_type: "sprint_interest_requested",
      channel: "email",
      sent_at: null,
    });
  }

  return { success: true };
}

export interface SprintInterestRequestRow {
  id: string;
  company_id: string;
  report_id: string;
  finding_id: string;
  status: "open" | "resolved";
  client_notes: string | null;
  created_at: string;
}

/** Reviewer-facing — lists open requests across all companies. */
export async function listOpenSprintInterestRequests(): Promise<(SprintInterestRequestRow & { companyName: string; findingTitle: string })[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sprint_interest_requests")
    .select("*, companies(name), lens_findings(ai_draft, reviewer_edited_content)")
    .eq("status", "open")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listOpenSprintInterestRequests: ${error.message}`);

  return (data ?? []).map((row) => {
    const company = row.companies as unknown as { name: string } | null;
    const finding = row.lens_findings as unknown as { ai_draft: { title: string }; reviewer_edited_content: { title: string } | null } | null;
    return {
      ...(row as unknown as SprintInterestRequestRow),
      companyName: company?.name ?? "Unknown company",
      findingTitle: finding?.reviewer_edited_content?.title ?? finding?.ai_draft?.title ?? "Unknown finding",
    };
  });
}

/** Reviewer-facing — dismisses/acknowledges a request. Doesn't create the sprint itself; the reviewer still starts it from the report workspace, same "Start an Execution Sprint" entry point as before. */
export async function resolveSprintInterestRequest(requestId: string, reviewerId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("sprint_interest_requests")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: reviewerId })
    .eq("id", requestId);
  if (error) throw new Error(`resolveSprintInterestRequest: ${error.message}`);
}
