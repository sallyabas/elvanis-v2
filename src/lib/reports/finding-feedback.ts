"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type FindingFeedbackSource = "lens_finding" | "module_finding";

export interface SubmitFindingFeedbackResult {
  success: boolean;
  error?: string;
}

/**
 * Real "does not apply to us" feedback (confirmed 2026-08-16, final
 * Dashboard redesign pass) — see the migration's own docblock
 * (20260816120000_finding_feedback.sql) for the full design reasoning.
 * Ownership is verified explicitly here, in application code, before the
 * admin client performs the actual insert — the same "session-scoped
 * client checks, admin client writes" pattern already established for
 * every other cross-table-reference write in this codebase (e.g.
 * submitEvidence()), since a real FK constraint can't express "this id
 * belongs to whichever of two tables `finding_source` says it does."
 */
export async function submitFindingNotApplicableFeedback(
  companyId: string,
  findingSource: FindingFeedbackSource,
  findingId: string,
  findingTitle: string,
): Promise<SubmitFindingFeedbackResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const { data: company } = await supabase.from("companies").select("id").eq("id", companyId).eq("user_id", user.id).maybeSingle();
  if (!company) return { success: false, error: "Not authorized for this company." };

  const admin = createAdminClient();

  // Real ownership verification, per source table — a finding_id has to
  // genuinely trace back to THIS company's own report/module request
  // before feedback can be logged against it, not just any finding_id the
  // client happens to submit.
  if (findingSource === "lens_finding") {
    const { data: finding } = await admin.from("lens_findings").select("id, reports(company_id)").eq("id", findingId).maybeSingle();
    const owningCompanyId = (finding?.reports as unknown as { company_id: string } | null)?.company_id;
    if (owningCompanyId !== companyId) return { success: false, error: "Finding not found for this company." };
  } else {
    const { data: finding } = await admin.from("module_findings").select("id, module_requests(company_id)").eq("id", findingId).maybeSingle();
    const owningCompanyId = (finding?.module_requests as unknown as { company_id: string } | null)?.company_id;
    if (owningCompanyId !== companyId) return { success: false, error: "Finding not found for this company." };
  }

  const { error } = await admin.from("finding_feedback").insert({
    company_id: companyId,
    finding_source: findingSource,
    finding_id: findingId,
    finding_title: findingTitle,
  });
  if (error) return { success: false, error: "Something went wrong saving your feedback." };

  return { success: true };
}

/** Real per-company set of already-flagged finding ids, so a reload doesn't let a client re-flag the same finding or forget they already did. */
export async function loadFlaggedFindingIds(companyId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("finding_feedback").select("finding_id").eq("company_id", companyId);
  return new Set((data ?? []).map((r) => r.finding_id as string));
}
