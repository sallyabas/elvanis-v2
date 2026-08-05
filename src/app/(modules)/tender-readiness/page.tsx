import { createAdminClient } from "@/lib/supabase/admin";
import { computeJurisdictionApplicability } from "@/lib/modules/tender-readiness/jurisdiction";
import { TenderReadinessIntakeForm } from "./TenderReadinessIntakeForm";

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
// KNOWN GAP, FLAGGED NOT SILENTLY SHIPPED: no client-auth system exists
// yet — same interim `?companyId=` addressing scheme as Business Profile
// and AI Reliability Audit, for the same reason.
export default async function TenderReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;

  if (!companyId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">Tender Readiness</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No company specified. Visit this page with <code>?companyId=&lt;id&gt;</code> — session-based lookup
          isn&apos;t built yet (no client-auth system exists).
        </p>
      </div>
    );
  }

  const supabase = createAdminClient();
  const { data: company, error } = await supabase
    .from("companies")
    .select("id, name, registration_country, uae_free_zone, customer_market_countries")
    .eq("id", companyId)
    .single();

  if (error || !company) {
    return <div className="p-6 text-sm text-red-600">Failed to load company: {error?.message ?? "not found"}</div>;
  }

  const jurisdictionInput = {
    registrationCountry: company.registration_country as string | null,
    uaeFreeZone: company.uae_free_zone as "mainland" | "difc" | "adgm" | null,
    customerMarketCountries: (company.customer_market_countries as string[]) ?? [],
  };
  const applicability = computeJurisdictionApplicability(jurisdictionInput);
  const applicableLabels = (Object.keys(applicability) as (keyof typeof applicability)[])
    .filter((k) => applicability[k])
    .map((k) => SECTION_LABELS[k]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Tender Readiness</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        AI-specific regulatory risk classification and procurement-readiness content, based on where {company.name} is
        registered and where its customers are.
      </p>

      <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 font-medium">Applicable jurisdictions (determined automatically, not something you select)</h2>
        {applicableLabels.length === 0 ? (
          <p className="text-neutral-500">
            No AI-specific jurisdiction currently applies, based on registration ({company.registration_country ?? "not set"}) and
            customer markets ({jurisdictionInput.customerMarketCountries.join(", ") || "none set"}).
          </p>
        ) : (
          <ul className="list-inside list-disc space-y-1">
            {applicableLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        )}
      </section>

      <TenderReadinessIntakeForm companyId={companyId} jurisdictionInput={jurisdictionInput} />
    </div>
  );
}
