import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingFlow } from "./OnboardingFlow";
import { HubResume } from "./HubResume";
import { PathBWizard } from "./PathBWizard";
import { hasCompletedPathBSetup } from "@/lib/onboarding/path-b-completion";
import { computePathBRouting, type TriageAiUsage, type TriageComplianceRequest, type TriagePersonalData } from "@/lib/onboarding/path-b-routing";

// Real Company/Goal creation (confirmed 2026-08-03, Priority 1) — a
// top-level route deliberately outside the (app) route group, so
// (app)/layout.tsx can redirect here unconditionally when a signed-in
// client has no company yet, without risking a redirect loop (this page
// isn't wrapped by that layout, so it's never itself subject to the
// redirect it's the target of).
//
// Gating logic extended 2026-08-27 (Onboarding Architecture & Path
// Routing brief, Part 1/4) — a company existing is no longer sufficient
// reason to redirect away. A company with entry_path='undecided' (created
// by the "I'm not sure yet" pick, or abandoned mid-flow before a real
// path was chosen from the Hub) is genuinely NOT done onboarding yet —
// this page resumes them straight at the Hub screen rather than bouncing
// them to /business-profile with nothing to show there.
//
// Extended again 2026-08-28 — a real, confirmed dead-end: Path B
// ('ai_audit') commits entry_path the instant the 5-field minimal profile
// is saved, well before triage/recommendation ever runs. Live testing
// confirmed a client who refreshes, navigates back, or restarts their
// browser at any point after that but before finishing triage was
// unconditionally bounced to /business-profile with no way back into the
// flow at all. `entry_path='ai_audit'` with no real module/session-request
// yet (hasCompletedPathBSetup) now resumes straight at the triage screen
// instead — the profile fields are already saved, so only the 3 short
// triage questions get re-asked, per the founder's own confirmed decision
// not to attempt full mid-triage/mid-recommendation resume.
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: existingCompany } = await supabase
    .from("companies")
    .select("id, name, entry_path, triage_ai_usage, triage_compliance_request, triage_personal_data")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingCompany) {
    if (existingCompany.entry_path === "undecided") {
      return (
        <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
          <HubResume companyId={existingCompany.id as string} companyName={existingCompany.name as string} />
        </div>
      );
    }

    if (existingCompany.entry_path === "ai_audit") {
      const done = await hasCompletedPathBSetup(createAdminClient(), existingCompany.id as string);
      if (!done) {
        // Real fix (confirmed 2026-08-31, direct founder bug report): this
        // resume branch previously always re-showed the 3 triage questions
        // from scratch, even when they were already answered and saved —
        // unlike the newer /ai-audit sidebar entry point, which reuses
        // saved answers via `initialRouting`. Same computation here now,
        // so the two resume paths behave identically rather than one
        // silently re-asking what the other already remembers.
        const aiUsage = existingCompany.triage_ai_usage as TriageAiUsage | null;
        const complianceRequest = existingCompany.triage_compliance_request as TriageComplianceRequest | null;
        const personalData = existingCompany.triage_personal_data as TriagePersonalData | null;
        const hasSavedTriage = !!aiUsage && !!complianceRequest && !!personalData;
        const initialRouting = hasSavedTriage ? computePathBRouting(aiUsage!, complianceRequest!, personalData!) : undefined;

        return (
          <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
            <PathBWizard
              mode="attach"
              existingCompanyId={existingCompany.id as string}
              existingCompanyName={existingCompany.name as string}
              startAtTriage={!hasSavedTriage}
              initialRouting={initialRouting}
            />
          </div>
        );
      }
    }

    redirect("/business-profile");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
      <OnboardingFlow />
    </div>
  );
}
