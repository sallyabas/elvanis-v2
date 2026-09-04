import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettingNumber } from "@/lib/app-settings";
import { computeJurisdictionApplicability } from "@/lib/modules/data-protection-compliance/jurisdiction";
import { isKnownJurisdictionCountry } from "@/lib/modules/shared/regions";
import { ApplicableRegulationsBox, type ApplicableRegulationItem } from "@/app/_components/ApplicableRegulationsBox";
import { JurisdictionQuickSetup } from "@/app/_components/JurisdictionQuickSetup";
import { Alert } from "@/app/_components/ui/Alert";
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
  uaePdpl: { label: "UAE federal PDPL" },
  adgmDpr: { label: "ADGM DPR 2021" },
  difcDpl: { label: "DIFC Data Protection Law", detail: "No. 5 of 2020" },
};

// Data Protection Compliance — standalone entry page, sellable independent
// of the core audit. See spec §1.8d for the confirmed design (GDPR-first
// build order, extended 2026-08-03 with a real Saudi PDPL branch, extended
// again 2026-09-03 with UAE federal PDPL + ADGM DPR 2021 — broader,
// AI-agnostic data protection; AI-specific governance/risk classification
// is Tender Readiness's job). Applicability is computed here,
// deterministically, from the company's already-stored
// registration/uae-free-zone/customer-market data — never re-asked of the
// client and never decided by the AI.
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
    .map((k) => REGIME_LABELS[k]);
  const hasNoApplicableJurisdiction = applicableItems.length === 0;

  // Item 5 (confirmed 2026-09-04) — genuinely empty, not a considered
  // "we operate nowhere regulated" answer. Only shown in this specific
  // case, not whenever hasNoApplicableJurisdiction is true (a company that
  // filled these in and genuinely triggers nothing has already given a
  // real answer — re-prompting it would be patronizing, not helpful; that
  // case is instead covered by the "not covered" warning below when it
  // applies).
  const jurisdictionFieldsAreEmpty = !company.registration_country && jurisdictionInput.customerMarketCountries.length === 0;

  // Item 8 (confirmed 2026-09-04) — "jurisdiction not covered" warning.
  // Distinguishes "genuinely nothing applies" (every real signal is a
  // known country, just not one this module covers) from "this app has no
  // logic at all for one of your real jurisdiction signals" — both
  // previously rendered identically, which could misread the second case
  // as a false compliance clearance. Computed independently of
  // hasNoApplicableJurisdiction — fires even when other regimes already
  // apply, since an uncovered customer market is worth disclosing either
  // way.
  const uncoveredCountries = [company.registration_country as string | null, ...jurisdictionInput.customerMarketCountries]
    .filter((c): c is string => Boolean(c))
    .filter((c) => !isKnownJurisdictionCountry(c));
  const uniqueUncoveredCountries = [...new Set(uncoveredCountries)];

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
              None of UK GDPR, EU GDPR, Saudi PDPL, UAE federal PDPL, ADGM DPR 2021, or the DIFC Data Protection Law
              currently apply, based on registration ({company.registration_country ?? "not set"}
              {company.uae_free_zone ? `, ${company.uae_free_zone}` : ""}) and customer markets (
              {jurisdictionInput.customerMarketCountries.join(", ") || "none set"}).
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
        footnote="DIFC's own law also reaches companies with a real, ongoing physical presence in DIFC even without formal DIFC registration — Business Profile now asks this directly if your registration is in the UAE."
      />

      {/* Item 5 (confirmed 2026-09-04) — real, inline fix, not just a link
          out to Business Profile, for the genuinely-empty case. */}
      {jurisdictionFieldsAreEmpty && <JurisdictionQuickSetup companyId={company.id as string} />}

      {/* Item 8 (confirmed 2026-09-04) — plainly discloses a real
          jurisdiction signal this module has no logic for at all,
          independent of whether other regimes already apply. */}
      {uniqueUncoveredCountries.length > 0 && (
        <Alert variant="warning" className="mb-6">
          Elvanis doesn&apos;t yet have built regulatory coverage for {uniqueUncoveredCountries.join(", ")}. This module
          currently covers the UK, EU member states, Saudi Arabia, and the UAE — if {uniqueUncoveredCountries.length === 1 ? "this" : "these"}{" "}
          genuinely describes where you&apos;re registered or where your customers are, this request won&apos;t surface
          jurisdiction-specific findings for {uniqueUncoveredCountries.length === 1 ? "it" : "them"} yet.
        </Alert>
      )}

      <DataProtectionIntakeForm companyId={company.id as string} jurisdictionInput={jurisdictionInput} reviewPeriodHours={reviewPeriodHours} />
    </div>
  );
}
