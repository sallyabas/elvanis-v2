import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GOAL_LABELS } from "@/lib/lenses/goals";
import type { PrimaryGoal } from "@/lib/lenses/types";
import { DesiredFutureStateField } from "./DesiredFutureStateField";
import { BusinessProfileForm } from "./BusinessProfileForm";
import { DigitalPresenceCheck } from "./DigitalPresenceCheck";
import type { CompanyProfileFields } from "./actions";
import { Card } from "@/app/_components/ui/Card";
import { LinkButton } from "@/app/_components/ui/LinkButton";
import { Alert } from "@/app/_components/ui/Alert";
import { NextStepBanner } from "@/app/_components/NextStepBanner";
import { ProgressStepper } from "@/app/_components/ProgressStepper";
import { computeJourneyStatus } from "@/lib/reports/journey-status";
import { hasCompletedPathBSetup } from "@/lib/onboarding/path-b-completion";

// Business Profile — the living record every lens prompt reads from at
// generation time. Confirmed 2026-08-04 (Priority 3): now fully
// session-derived, not `?companyId=`/`?goalId=` — the `(app)` layout
// already guarantees an authenticated client with a real company exists
// before this page renders. Renders the full field set (company identity,
// brand, business context), not just the one goal-linked field.
export default async function BusinessProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(
      "id, name, industry, business_model, employee_count, stage, website_url, social_links, revenue_range_band, customer_type, main_tools_stack, team_structure_summary, registration_country, uae_free_zone, customer_market_countries, has_ai_in_production, entry_path",
    )
    .eq("user_id", user.id)
    .single();

  if (companyError || !company) {
    redirect("/onboarding");
  }

  const { data: goal } = await supabase
    .from("goals")
    .select("id, primary_goal, secondary_goal, desired_future_state_primary, desired_future_state_secondary")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Admin client here ONLY for the journey-status check — see
  // journey-status.ts's own docblock: `reports`' client-facing RLS only
  // allows status='sent' through, so a session-scoped query would silently
  // misreport an in-review company as having submitted nothing. companyId
  // is already ownership-verified above via the session client.
  const journeyStatus = await computeJourneyStatus(createAdminClient(), company.id as string);

  // Real, confirmed dead-end fix (2026-08-28, Onboarding Architecture &
  // Path Routing brief, item 1) — Business Profile is the LITERAL page a
  // Path B ('ai_audit') client gets redirected to the instant their
  // 5-field profile is saved, before triage/recommendation ever finishes.
  // Live testing confirmed this left them stranded here with zero trace
  // back into the flow on refresh, back-navigation, or a browser restart.
  // See hasCompletedPathBSetup()'s own docblock for what "done" means.
  const pathBSetupDone = company.entry_path === "ai_audit" ? await hasCompletedPathBSetup(createAdminClient(), company.id as string) : true;

  const socialLinks = (company.social_links as { links?: string[] } | null)?.links ?? [];
  const mainToolsStack = (company.main_tools_stack as { tools?: string[] } | null)?.tools ?? [];

  const initialFields: CompanyProfileFields = {
    name: company.name as string,
    industry: company.industry as string | null,
    businessModel: company.business_model as "B2B" | "B2C" | null,
    employeeCount: company.employee_count as number | null,
    stage: company.stage as string | null,
    websiteUrl: company.website_url as string | null,
    socialLinks,
    revenueRangeBand: company.revenue_range_band as string | null,
    customerType: company.customer_type as string | null,
    mainToolsStack,
    teamStructureSummary: company.team_structure_summary as string | null,
    registrationCountry: company.registration_country as string | null,
    uaeFreeZone: company.uae_free_zone as "mainland" | "difc" | "adgm" | null,
    customerMarketCountries: (company.customer_market_countries as string[] | null) ?? [],
    hasAiInProduction: company.has_ai_in_production as boolean | null,
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Business Profile</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        The living record every lens prompt reads from — changes are logged and tracked over time.
      </p>

      {company.entry_path === "ai_audit" && !pathBSetupDone && (
        <div className="mb-6">
          <Alert variant="warning">
            <span className="font-medium">You haven&apos;t finished setting up your AI Audit yet.</span> A couple of quick
            questions decide which one applies to you — your profile is already saved, so this only takes a moment.{" "}
            <LinkButton href="/onboarding" className="mt-2 inline-block">
              Finish setting up your AI Audit →
            </LinkButton>
          </Alert>
        </div>
      )}

      <ProgressStepper journeyStatus={journeyStatus} />
      <NextStepBanner journeyStatus={journeyStatus} />

      <div className="space-y-6">
        <Card title="Company details">
          <BusinessProfileForm companyId={company.id as string} initial={initialFields} />
        </Card>

        <Card title="Digital presence check">
          <DigitalPresenceCheck companyId={company.id as string} hasWebsiteUrl={!!company.website_url} />
        </Card>

        {goal && (
          <>
            <Card title={`Primary goal: ${GOAL_LABELS[goal.primary_goal as PrimaryGoal]}`}>
              <DesiredFutureStateField
                goalId={goal.id}
                field="primary"
                initialValue={goal.desired_future_state_primary}
                label="What would good look like here?"
              />
            </Card>

            {goal.secondary_goal && (
              <Card title={`Secondary goal: ${GOAL_LABELS[goal.secondary_goal as PrimaryGoal]}`}>
                <DesiredFutureStateField
                  goalId={goal.id}
                  field="secondary"
                  initialValue={goal.desired_future_state_secondary}
                  label="What would good look like here?"
                />
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
