import { createAdminClient } from "@/lib/supabase/admin";
import { computeJurisdictionApplicability } from "@/lib/modules/data-protection-compliance/jurisdiction";
import { DataProtectionIntakeForm } from "./DataProtectionIntakeForm";

const REGIME_LABELS: Record<string, string> = {
  ukGdpr: "UK GDPR",
  euGdpr: "EU GDPR",
  saudiPdpl: "Saudi PDPL",
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
// KNOWN GAP, FLAGGED NOT SILENTLY SHIPPED: no client-auth system exists
// yet — same interim `?companyId=` addressing scheme as Business Profile,
// AI Reliability Audit, and Tender Readiness, for the same reason.
export default async function DataProtectionCompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;

  if (!companyId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">Data Protection Compliance</h1>
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
    .select("id, name, registration_country, customer_market_countries")
    .eq("id", companyId)
    .single();

  if (error || !company) {
    return <div className="p-6 text-sm text-red-600">Failed to load company: {error?.message ?? "not found"}</div>;
  }

  const jurisdictionInput = {
    registrationCountry: company.registration_country as string | null,
    customerMarketCountries: (company.customer_market_countries as string[]) ?? [],
  };
  const applicability = computeJurisdictionApplicability(jurisdictionInput);
  const applicableLabels = (Object.keys(applicability) as (keyof typeof applicability)[])
    .filter((k) => applicability[k])
    .map((k) => REGIME_LABELS[k]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Data Protection Compliance</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Data-protection compliance readiness across consent, data-subject rights, retention, breach response, and
        cross-border transfer, based on where {company.name} is registered and where its customers are.
      </p>

      <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 font-medium">Applicable regulations (determined automatically, not something you select)</h2>
        {applicableLabels.length === 0 ? (
          <p className="text-neutral-500">
            None of UK GDPR, EU GDPR, or Saudi PDPL currently apply, based on registration ({company.registration_country ?? "not set"}) and
            customer markets ({jurisdictionInput.customerMarketCountries.join(", ") || "none set"}).
          </p>
        ) : (
          <ul className="list-inside list-disc space-y-1">
            {applicableLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-neutral-400">
          The UAE&apos;s data-protection regime (federal PDPL, ADGM DPR 2021) isn&apos;t assessed by this module yet — it&apos;s a planned extension for once Gulf market entry is real.
        </p>
      </section>

      <DataProtectionIntakeForm companyId={companyId} jurisdictionInput={jurisdictionInput} />
    </div>
  );
}
