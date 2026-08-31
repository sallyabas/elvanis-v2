import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PathBWizard } from "@/app/onboarding/PathBWizard";
import { computePathBRouting, type TriageAiUsage, type TriageComplianceRequest, type TriagePersonalData } from "@/lib/onboarding/path-b-routing";

/**
 * Real "AI Audit" sidebar entry point (confirmed 2026-08-31, sidebar
 * rework, items 3-4) — a genuinely new destination, reachable regardless
 * of `entry_path` or whether Path B was ever started for this company
 * (cross-discovery: a diagnosis-path client can land here too). Deliberately
 * inside `(app)`, not `/onboarding` — `/onboarding`'s own redirect-away
 * logic treats any committed `entry_path` as "done" and would bounce a
 * diagnosis-path client straight back out; this page has no such gate.
 *
 * "Triage only shows if no saved answers exist yet — reuses saved answers
 * otherwise, never re-asks": computed here, server-side, from the real
 * `companies.triage_*` columns (already captured, regardless of path,
 * since the 2026-08-27 Path B build) — never re-derived from a fresh
 * client-side guess. The 5-field Path B minimal profile is never shown
 * here either way — those fields (registration/customer-market) live on
 * Business Profile now for every company, not just Path B's own onboarding
 * flow, so re-asking them from this entry point would be a real
 * regression, not caution.
 */
export default async function AiAuditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/client-login");

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, triage_ai_usage, triage_compliance_request, triage_personal_data")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!company) redirect("/onboarding");

  const aiUsage = company.triage_ai_usage as TriageAiUsage | null;
  const complianceRequest = company.triage_compliance_request as TriageComplianceRequest | null;
  const personalData = company.triage_personal_data as TriagePersonalData | null;
  const hasSavedTriage = !!aiUsage && !!complianceRequest && !!personalData;

  const initialRouting = hasSavedTriage ? computePathBRouting(aiUsage!, complianceRequest!, personalData!) : undefined;

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <PathBWizard
        mode="attach"
        existingCompanyId={company.id as string}
        existingCompanyName={company.name as string}
        startAtTriage={!hasSavedTriage}
        initialRouting={initialRouting}
      />
    </div>
  );
}
