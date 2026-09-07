"use server";

import { createClient } from "@/lib/supabase/server";
import { requestSprintChooseOwnFinding, requestSprintLetElvanisChoose } from "@/lib/execution-sprint/workspace";

/**
 * The client-facing "I'll choose the finding myself" / "Let Elvanis
 * decide" entry point (confirmed 2026-09-07, unified flow spec) —
 * session-scoped, RLS-respecting, same ownership-verification pattern as
 * requestSprintInterest() (interest-requests.ts): re-verifies the caller
 * owns the company and the report before delegating to the admin-client
 * workspace functions, since these are directly-reachable Server Actions
 * independent of whichever page renders their UI.
 */

export interface RequestSprintResult {
  success: boolean;
  error?: string;
  sprintId?: string;
}

async function verifyOwnership(companyId: string, reportId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: company, error: companyError } = await supabase.from("companies").select("id").eq("id", companyId).eq("user_id", user.id).maybeSingle();
  if (companyError || !company) return { ok: false, error: "Company not found." };

  const { data: report, error: reportError } = await supabase.from("reports").select("id").eq("id", reportId).eq("company_id", companyId).maybeSingle();
  if (reportError || !report) return { ok: false, error: "Report not found." };

  return { ok: true };
}

export async function requestSprintChooseOwnFindingAction(companyId: string, reportId: string, findingId: string): Promise<RequestSprintResult> {
  const ownership = await verifyOwnership(companyId, reportId);
  if (!ownership.ok) return { success: false, error: ownership.error };

  try {
    const { sprintId } = await requestSprintChooseOwnFinding(reportId, findingId);
    return { success: true, sprintId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function requestSprintLetElvanisChooseAction(companyId: string, reportId: string): Promise<RequestSprintResult> {
  const ownership = await verifyOwnership(companyId, reportId);
  if (!ownership.ok) return { success: false, error: ownership.error };

  try {
    const { sprintId } = await requestSprintLetElvanisChoose(reportId);
    return { success: true, sprintId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
