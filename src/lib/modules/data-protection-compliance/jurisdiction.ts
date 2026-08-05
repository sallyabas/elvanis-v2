/**
 * Deterministic jurisdiction applicability for Data Protection Compliance
 * (spec §1.8d, confirmed 2026-08-02; extended 2026-08-03 with Saudi PDPL) —
 * computed in code, never AI-judged. Same reasoning as Tender Readiness's
 * jurisdiction.ts.
 *
 * GDPR-first build order (spec §1.8a), but Saudi PDPL is now built in as a
 * real branch, not deferred — PDPL is already actively enforced today, not
 * a future law waiting on Gulf market entry (confirmed 2026-08-03,
 * correcting the earlier "deferred until Gulf entry is real" framing).
 * The UAE's data-protection regime (federal PDPL, ADGM DPR 2021) is still
 * out of scope — genuinely gated on Gulf entry, unlike Saudi PDPL.
 *
 * Correction to §1.8a's original framing: §1.8a described GDPR (and by
 * extension PDPL) as triggered only by `customer_market_countries` (the
 * same extraterritorial-only pattern correctly used for Tender Readiness's
 * EU AI Act). That's only half of GDPR's actual territorial scope (Article
 * 3): Article 3(1) also applies GDPR to any controller *established* in
 * the EU/UK regardless of where its customers are, independent of the
 * extraterritorial Article 3(2) trigger. Saudi PDPL has the same two-part
 * structure — it applies to any controller established/residing in Saudi
 * Arabia, and separately (extraterritorially) to processing of Saudi
 * residents' data by controllers with no Saudi establishment, where that
 * processing relates to offering goods/services to them. Both triggers are
 * implemented for all three regimes below.
 */

import { normalize, EU_MEMBER_STATES, UK_NAMES, SAUDI_ARABIA_NAMES } from "../shared/regions";

export interface CompanyJurisdictionInput {
  registrationCountry: string | null;
  customerMarketCountries: string[];
}

export interface JurisdictionApplicability {
  /** Triggered by UK establishment (registration) OR offering goods/services to UK-based individuals (Article 3). */
  ukGdpr: boolean;
  /** Triggered by EU establishment (registration in an EU member state) OR offering goods/services to EU-based individuals (Article 3). */
  euGdpr: boolean;
  /** Triggered by Saudi establishment (registration) OR offering goods/services to Saudi-resident individuals — same establishment/extraterritorial structure as GDPR. */
  saudiPdpl: boolean;
}

export function computeJurisdictionApplicability(company: CompanyJurisdictionInput): JurisdictionApplicability {
  const registration = company.registrationCountry !== null ? normalize(company.registrationCountry) : null;
  const customerMarkets = company.customerMarketCountries.map(normalize);

  const registeredInUk = registration !== null && UK_NAMES.has(registration);
  const registeredInEu = registration !== null && EU_MEMBER_STATES.has(registration);
  const registeredInSaudi = registration !== null && SAUDI_ARABIA_NAMES.has(registration);
  const hasUkCustomers = customerMarkets.some((c) => UK_NAMES.has(c));
  const hasEuCustomers = customerMarkets.some((c) => EU_MEMBER_STATES.has(c));
  const hasSaudiCustomers = customerMarkets.some((c) => SAUDI_ARABIA_NAMES.has(c));

  return {
    ukGdpr: registeredInUk || hasUkCustomers,
    euGdpr: registeredInEu || hasEuCustomers,
    saudiPdpl: registeredInSaudi || hasSaudiCustomers,
  };
}

/** True if none of UK GDPR, EU GDPR, or Saudi PDPL apply — a company entirely outside this module's current scope. */
export function hasNoApplicableRegulations(applicability: JurisdictionApplicability): boolean {
  return !applicability.ukGdpr && !applicability.euGdpr && !applicability.saudiPdpl;
}
