import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettingNumber } from "@/lib/app-settings";
import { computeJurisdictionApplicability } from "@/lib/modules/data-protection-compliance/jurisdiction";
import { ApplicableRegulationsBox, type ApplicableRegulationItem } from "@/app/_components/ApplicableRegulationsBox";
import { DataProtectionIntakeForm } from "./DataProtectionIntakeForm";

/**
 * Real root cause found in production 2026-08-15 (see tender-readiness's
 * page.tsx for the full writeup) — same fix applied here: a real,
 * synchronous Groq call with no `maxDuration` configured risks being
 * killed by the platform's default serverless timeout mid-flight.
 */
export const maxDuration = 60;

// Real fix (confirmed 2026-08-15, live copy/hierarchy testing) — see
// ApplicableRegulationsBox for how these render; same shape as Tender
// Readiness's own SECTION_LABELS for consistency.
const REGIME_LABELS: Record<string, ApplicableRegulationItem> = {
  ukGdpr: { label: "UK GDPR" },
  euGdpr: { label: "EU GDPR" },
  saudiPdpl: { label: "Saudi PDPL" },
};

// Data Protection Compliance — standalone entry page, sellable independent
// of the core audit. See spec §1.8d for the confirmed design (GDPR-first
// build order, extended 2026-08-03 with a real Saudi PDPL branch — broader,
// AI-agnostic data protection; AI-specific governance/risk classification
// is Tender Readiness's job). Applicability is computed here,
// deterministically, from the company's already-stored
// registration/customer-market data — never re-asked of the client and
// never decided by the AI.
//
// Moved into the (app) route group 2026-08-15 (real bug found and fixed,
// module intake/service flow review) — same fix, same reasoning as Tender
// Readiness's own page.tsx: this page had no site nav and trusted an
// unauthenticated `?companyId=` query param with no session check, even
// though real client auth has existed app-wide since 2026-08-03. Now
// fully session-derived, never trusted from a query param.
export default async function DataProtectionCompliancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, registration_country, customer_market_countries")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!company) {
    redirect("/onboarding");
  }

  const reviewPeriodHours = await getSettingNumber("review_period_hours", 48);

  const jurisdictionInput = {
    registrationCountry: company.registration_country as string | null,
    customerMarketCountries: (company.customer_market_countries as string[]) ?? [],
  };
  const applicability = computeJurisdictionApplicability(jurisdictionInput);
  const applicableItems = (Object.keys(applicability) as (keyof typeof applicability)[])
    .filter((k) => applicability[k])
    .map((k) => REGIME_LABELS[k]);
  const hasNoApplicableJurisdiction = applicableItems.length === 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Data Protection Compliance</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Data-protection compliance readiness across consent, data-subject rights, retention, breach response, and
        cross-border transfer, based on where {company.name} is registered and where its customers are.
      </p>

      <ApplicableRegulationsBox
        items={applicableItems}
        noneContent={
          <div>
            <p>
              None of UK GDPR, EU GDPR, or Saudi PDPL currently apply, based on registration ({company.registration_country ?? "not set"}) and
              customer markets ({jurisdictionInput.customerMarketCountries.join(", ") || "none set"}).
            </p>
            {/* Real gap found and closed 2026-08-15 (module intake/service
                flow review) — if these fields were genuinely never filled
                in (not a considered "we operate nowhere regulated"
                answer), the client had no way to know that, or where to
                fix it. Business Profile now has real fields for both. */}
            <p className="mt-2">
              If this doesn&apos;t look right, add your registration country and customer markets on{" "}
              <a href="/business-profile" className="font-medium text-accent underline hover:text-accent-hover">
                Business Profile
              </a>{" "}
              — you can still submit below without them, but this request likely won&apos;t surface any jurisdiction-specific
              findings until they&apos;re set.
            </p>
          </div>
        }
        footnote="The UAE's data-protection regime (federal PDPL, ADGM DPR 2021) isn't assessed by this module yet — it's a planned extension for once Gulf market entry is real."
      />

      <DataProtectionIntakeForm companyId={company.id as string} jurisdictionInput={jurisdictionInput} reviewPeriodHours={reviewPeriodHours} />
    </div>
  );
}
