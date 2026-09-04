import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GOAL_LABELS } from "@/lib/lenses/goals";
import type { PrimaryGoal } from "@/lib/lenses/types";
import { DesiredFutureStateField } from "./DesiredFutureStateField";
import { BusinessProfileForm } from "./BusinessProfileForm";
import { DigitalPresenceCheck } from "./DigitalPresenceCheck";
import { EntryPathSetting } from "./EntryPathSetting";
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
      "id, name, industry, business_model, employee_count, stage, website_url, social_links, revenue_range_band, customer_type, main_tools_stack, team_structure_summary, registration_country, uae_free_zone, customer_market_countries, has_ai_in_production, difc_stable_arrangements, entry_path",
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

  // Real gap closed (confirmed 2026-08-31, direct founder investigation
  // request) — free-tier/first-audit-free status was genuinely invisible
  // anywhere on Business Profile. Same "at least one report ever reached
  // status='sent'" check evidence-intake's own confirmation modal already
  // uses (see that page's `isFreeAudit` computation) — a genuinely shared
  // fact, not a second, differently-derived version of the same answer.
  const { data: priorSentReports } = await supabase.from("reports").select("id").eq("company_id", company.id).eq("status", "sent").limit(1);
  const isFreeAuditAvailable = (priorSentReports ?? []).length === 0;

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
    difcStableArrangements: company.difc_stable_arrangements as "yes" | "no" | "not_sure" | null,
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Business Profile</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        The living record every lens prompt reads from — changes are logged and tracked over time.
      </p>

      {/* Free-tier status indicator (confirmed 2026-08-31, direct founder
          investigation request) — real gap: this was invisible anywhere on
          Business Profile before this. */}
      <div className="mb-6">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
            isFreeAuditAvailable
              ? "border-accent/40 bg-[#fffbf0] text-accent"
              : "border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400"
          }`}
        >
          {isFreeAuditAvailable ? "Your first Core Audit is free — not yet used" : "Free first audit already used — re-audits are paid"}
        </span>
      </div>

      {/* Compact "at a glance" goal summary (confirmed 2026-08-31, direct
          founder follow-up to item 2) — the full editor cards further down
          ("Primary goal: X" / "Secondary goal: Y") are real and were
          already there, but read as section headers for a narrative-field
          editor, not a status summary — easy to miss as "the goal
          display." This mirrors Dashboard's own pill (same border/bg/text
          treatment) so a client sees their stated goals at a glance
          without reading into the editor sections below, which stay
          exactly as they are — this is additive, not a replacement. */}
      {goal && (
        <div className="mb-6">
          <p className="inline-flex flex-wrap items-center gap-x-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-400">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">Your goal:</span>
            {GOAL_LABELS[goal.primary_goal as PrimaryGoal]}
            {goal.secondary_goal && <span>· also: {GOAL_LABELS[goal.secondary_goal as PrimaryGoal]}</span>}
          </p>
        </div>
      )}

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

        {/* Relocated here from Account Settings (confirmed 2026-08-31,
            direct founder decision) — "what are you here for" is
            conceptually the same category as the goal fields below (what
            the business wants from the platform), not personal account
            identity, which is what Account Settings is actually for. Same
            component, same dropdown/copy/chooseEntryPath() behavior —
            see EntryPathSetting.tsx's own docblock for the full history. */}
        <Card title="Your focus">
          <EntryPathSetting companyId={company.id as string} currentEntryPath={company.entry_path as string} />
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
                {/* Honest weighting disclosure (confirmed 2026-08-31) —
                    same copy and same reasoning as the Dashboard's own
                    goal pill; see that page's docblock for the ranking-
                    code investigation behind this. */}
                <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                  Both goals are shared with your audit as context — we don&apos;t currently guarantee one is weighted more
                  heavily than the other.
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
