import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettingNumber } from "@/lib/app-settings";
import { computeJurisdictionApplicability } from "@/lib/modules/tender-readiness/jurisdiction";
import { TenderReadinessIntakeForm } from "./TenderReadinessIntakeForm";

/**
 * Real root cause found in production 2026-08-15, not just the client-side
 * symptom: `submitTenderReadinessAudit()` runs a real, synchronous Groq
 * call inside its Server Action, and this route had no `maxDuration`
 * configured — Vercel's default serverless function timeout can kill that
 * request mid-flight during a slow or rate-limited Groq run (this codebase
 * has extensively documented real Groq rate-limit/slowness events
 * elsewhere), returning a raw 500 the client never receives as a resolved
 * promise. Raising this to the practical ceiling doesn't fix a slow Groq
 * call by itself, but it gives one a real chance to finish instead of
 * being killed after a few seconds — paired with the client-side
 * try/catch fix in TenderReadinessIntakeForm.tsx, which guarantees the
 * client sees a real error instead of an infinite spinner even if this
 * still isn't enough headroom on a given request.
 */
export const maxDuration = 60;

const SECTION_LABELS: Record<string, string> = {
  euAiAct: "EU AI Act (4-tier risk classification)",
  uaeDifcReg10: "UAE DIFC Regulation 10",
  saudiAiGovernance: "Saudi AI governance (SDAIA)",
  uaeAiCharterReference: "UAE AI Charter (non-binding reference)",
};

// Tender Readiness — standalone entry page, sellable independent of the
// core audit. See spec §1.8b for the confirmed design (AI-specific
// jurisdictions only — EU AI Act, UAE DIFC Reg 10, Saudi AI governance;
// GDPR/PDPL-style data protection is Data Protection Compliance's job).
// Applicability is computed here, deterministically, from the company's
// already-stored registration/customer-market data — never re-asked of
// the client and never decided by the AI.
//
// Moved into the (app) route group 2026-08-15 (real bug found and fixed,
// module intake/service flow review) — this page, like the other two
// standalone modules, had lived outside (app) since it was first built,
// trusting an unauthenticated `?companyId=` query param with no session
// check of its own — the same gap already found and fixed for Evidence
// Intake on 2026-08-12. Real client auth has existed app-wide since
// 2026-08-03; this page's own "no client-auth system exists yet" comment
// was simply never updated when that landed. Now fully session-derived,
// same pattern as every other (app) page — the (app) layout guarantees an
// authenticated client with a real company exists before this renders,
// and the company here is that session's own, never trusted from a query
// param (closing a real, latent cross-company-access gap in the same
// pass, not just adding a nav bar around the old behavior).
export default async function TenderReadinessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, registration_country, uae_free_zone, customer_market_countries")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!company) {
    redirect("/onboarding");
  }

  const reviewPeriodHours = await getSettingNumber("review_period_hours", 48);

  const jurisdictionInput = {
    registrationCountry: company.registration_country as string | null,
    uaeFreeZone: company.uae_free_zone as "mainland" | "difc" | "adgm" | null,
    customerMarketCountries: (company.customer_market_countries as string[]) ?? [],
  };
  const applicability = computeJurisdictionApplicability(jurisdictionInput);
  const applicableLabels = (Object.keys(applicability) as (keyof typeof applicability)[])
    .filter((k) => applicability[k])
    .map((k) => SECTION_LABELS[k]);
  const hasNoApplicableJurisdiction = applicableLabels.length === 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Tender Readiness</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        AI-specific regulatory risk classification and procurement-readiness content, based on where {company.name} is
        registered and where its customers are.
      </p>

      <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 font-medium">Applicable jurisdictions (determined automatically, not something you select)</h2>
        {hasNoApplicableJurisdiction ? (
          <div className="text-neutral-500">
            <p>
              No AI-specific jurisdiction currently applies, based on registration ({company.registration_country ?? "not set"}) and
              customer markets ({jurisdictionInput.customerMarketCountries.join(", ") || "none set"}).
            </p>
            {/* Real gap found and closed 2026-08-15 (module intake/service
                flow review) — if that's because these fields were genuinely
                never filled in (not a considered "we operate nowhere
                regulated" answer), the client had no way to know that, or
                where to fix it. Business Profile now has real fields for
                both. */}
            <p className="mt-2">
              If this doesn&apos;t look right, add your registration country and customer markets on{" "}
              <a href="/business-profile" className="font-medium text-accent underline hover:text-accent-hover">
                Business Profile
              </a>{" "}
              — you can still submit below without them, but this request likely won&apos;t surface any jurisdiction-specific
              findings until they&apos;re set.
            </p>
          </div>
        ) : (
          <ul className="list-inside list-disc space-y-1">
            {applicableLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        )}
      </section>

      <TenderReadinessIntakeForm companyId={company.id as string} jurisdictionInput={jurisdictionInput} reviewPeriodHours={reviewPeriodHours} />
    </div>
  );
}
