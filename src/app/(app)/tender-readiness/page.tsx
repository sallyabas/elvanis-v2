import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettingNumber } from "@/lib/app-settings";
import { computeJurisdictionApplicability } from "@/lib/modules/tender-readiness/jurisdiction";
import { isKnownJurisdictionCountry } from "@/lib/modules/shared/regions";
import { ApplicableRegulationsBox, type ApplicableRegulationItem } from "@/app/_components/ApplicableRegulationsBox";
import { JurisdictionQuickSetup } from "@/app/_components/JurisdictionQuickSetup";
import { Alert } from "@/app/_components/ui/Alert";
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

// Real fix (confirmed 2026-08-15, live copy/hierarchy testing): the
// previous single-string labels (e.g. "EU AI Act (4-tier risk
// classification)") baked the technical descriptor into the same string
// as the primary name, making the whole thing read as one long, dense
// label. Split into a short primary label plus optional muted detail —
// see ApplicableRegulationsBox for how these render.
const SECTION_LABELS: Record<string, ApplicableRegulationItem> = {
  euAiAct: { label: "EU AI Act", detail: "4-tier risk classification" },
  uaeDifcReg10: { label: "UAE DIFC Regulation 10" },
  saudiAiGovernance: { label: "Saudi AI governance", detail: "SDAIA" },
  uaeAiCharterReference: { label: "UAE AI Charter", detail: "non-binding reference" },
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
  const applicableItems = (Object.keys(applicability) as (keyof typeof applicability)[])
    .filter((k) => applicability[k])
    .map((k) => SECTION_LABELS[k]);
  const hasNoApplicableJurisdiction = applicableItems.length === 0;

  // Item 5 (confirmed 2026-09-04) — see data-protection-compliance's own
  // page.tsx for the full reasoning; identical here.
  const jurisdictionFieldsAreEmpty = !company.registration_country && jurisdictionInput.customerMarketCountries.length === 0;

  // Item 8 (confirmed 2026-09-04) — see data-protection-compliance's own
  // page.tsx for the full reasoning; identical here, since "does this app
  // have any logic for this country" is independent of which module's
  // specific regimes are being checked.
  const uncoveredCountries = [company.registration_country as string | null, ...jurisdictionInput.customerMarketCountries]
    .filter((c): c is string => Boolean(c))
    .filter((c) => !isKnownJurisdictionCountry(c));
  const uniqueUncoveredCountries = [...new Set(uncoveredCountries)];

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Tender Readiness</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        AI-specific regulatory risk classification and procurement-readiness content, based on where {company.name} is
        registered and where its customers are.
      </p>

      <ApplicableRegulationsBox
        items={applicableItems}
        noneContent={
          <div>
            <p>
              No AI-specific jurisdiction currently applies, based on registration ({company.registration_country ?? "not set"}) and
              customer markets ({jurisdictionInput.customerMarketCountries.join(", ") || "none set"}).
            </p>
            {!jurisdictionFieldsAreEmpty && (
              <p className="mt-2">
                If this doesn&apos;t look right, update your registration country and customer markets on{" "}
                <a href="/business-profile" className="font-medium text-accent underline hover:text-accent-hover">
                  Business Profile
                </a>
                .
              </p>
            )}
          </div>
        }
      />

      {/* Item 5 (confirmed 2026-09-04) — real, inline fix, not just a link
          out to Business Profile, for the genuinely-empty case. */}
      {jurisdictionFieldsAreEmpty && <JurisdictionQuickSetup companyId={company.id as string} />}

      {/* Item 8 (confirmed 2026-09-04) — plainly discloses a real
          jurisdiction signal this module has no logic for at all. */}
      {uniqueUncoveredCountries.length > 0 && (
        <Alert variant="warning" className="mb-6">
          Elvanis doesn&apos;t yet have built regulatory coverage for {uniqueUncoveredCountries.join(", ")}. This module
          currently covers the UK, EU member states, Saudi Arabia, and the UAE — if {uniqueUncoveredCountries.length === 1 ? "this" : "these"}{" "}
          genuinely describes where you&apos;re registered or where your customers are, this request won&apos;t surface
          jurisdiction-specific findings for {uniqueUncoveredCountries.length === 1 ? "it" : "them"} yet.
        </Alert>
      )}

      <TenderReadinessIntakeForm companyId={company.id as string} jurisdictionInput={jurisdictionInput} reviewPeriodHours={reviewPeriodHours} />
    </div>
  );
}
