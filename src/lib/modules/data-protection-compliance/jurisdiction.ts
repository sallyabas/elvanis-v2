/**
 * Deterministic jurisdiction applicability for Data Protection Compliance
 * (spec §1.8d, confirmed 2026-08-02; extended 2026-08-03 with Saudi PDPL;
 * extended again 2026-09-03 with UAE federal PDPL + ADGM DPR 2021) —
 * computed in code, never AI-judged. Same reasoning as Tender Readiness's
 * jurisdiction.ts.
 *
 * GDPR-first build order (spec §1.8a), Saudi PDPL added 2026-08-03 as a
 * real branch (already actively enforced, not gated on future Gulf entry).
 * The UAE's own data-protection regime was the one piece still explicitly
 * gated ("genuinely gated on real UAE client exposure") — that gate was
 * confirmed lifted 2026-09-03, and both real UAE regimes are now built.
 *
 * Correction to §1.8a's original framing: §1.8a described GDPR (and by
 * extension PDPL) as triggered only by `customer_market_countries` (the
 * same extraterritorial-only pattern correctly used for Tender Readiness's
 * EU AI Act). That's only half of GDPR's actual territorial scope (Article
 * 3): Article 3(1) also applies GDPR to any controller *established* in
 * the EU/UK regardless of where its customers are, independent of the
 * extraterritorial Article 3(2) trigger. Saudi PDPL has the same two-part
 * structure. UAE federal PDPL (Federal Decree-Law No. 45 of 2021, Article
 * 2) is confirmed to have the identical two-trigger shape — established in
 * the UAE and processing data anywhere, OR established outside the UAE and
 * processing UAE residents' data — via live research (not recalled from
 * training data, same non-fabrication discipline already applied to Saudi
 * PDPL and the export-signature/menu-path research elsewhere in this
 * codebase): https://securiti.ai/uae-personal-data-protection-law/,
 * https://gowlingwlg.com/en/insights-resources/articles/2022/uae-federal-decree-law-on-personal-data-protection.
 *
 * ADGM DPR 2021 is genuinely different in shape, confirmed by research, not
 * assumed to match the others — it is establishment-ONLY, no extraterritorial
 * trigger at all (ADGM's own public consultation record explicitly notes it
 * deliberately does not carry GDPR's extensive territorial scope):
 * https://www.clearycyberwatch.com/2021/04/adgm-enacts-new-data-protection-regulations-2021/,
 * https://securiti.ai/abu-dhabi-global-market-data-protection-regulation/.
 * Same registration-only shape already used for Tender Readiness's
 * `uaeDifcReg10` flag — a real, repeated pattern for UAE free-zone regimes,
 * not a one-off assumption.
 *
 * Federal PDPL's own confirmed exemption (Article 2(2)): entities
 * established in a UAE free zone that has its own data-protection law are
 * exempt from the FEDERAL law specifically for their establishment there —
 * DIFC (its own separate DIFC Data Protection Law No. 5 of 2020) and ADGM
 * (DPR 2021, built here) both qualify. `uaePdpl`'s establishment prong is
 * therefore deliberately scoped to mainland UAE registration and any UAE
 * free zone OTHER than DIFC/ADGM — not "any UAE registration" — while its
 * extraterritorial prong (UAE-resident customers) fires regardless of
 * where the company itself is registered, same as every other regime here.
 *
 * Real, deliberate scope boundary, not a silent omission: DIFC's own
 * separate Data Protection Law No. 5 of 2020 is NOT built here — the
 * founder's own request named only "UAE PDPL/ADGM," and DIFC's data-
 * protection regime is a third, genuinely distinct law this module has
 * never covered (Tender Readiness's DIFC Regulation 10 is AI-specific, a
 * different regime entirely, already covered there). Flagged explicitly
 * rather than silently built or silently left unmentioned — a real,
 * confirmed gap for a future pass if UAE DIFC-registered clients become
 * common enough to warrant it.
 */

import { normalize, EU_MEMBER_STATES, UK_NAMES, SAUDI_ARABIA_NAMES, UAE_NAMES } from "../shared/regions";

export interface CompanyJurisdictionInput {
  registrationCountry: string | null;
  uaeFreeZone: "mainland" | "difc" | "adgm" | null;
  customerMarketCountries: string[];
}

export interface JurisdictionApplicability {
  /** Triggered by UK establishment (registration) OR offering goods/services to UK-based individuals (Article 3). */
  ukGdpr: boolean;
  /** Triggered by EU establishment (registration in an EU member state) OR offering goods/services to EU-based individuals (Article 3). */
  euGdpr: boolean;
  /** Triggered by Saudi establishment (registration) OR offering goods/services to Saudi-resident individuals — same establishment/extraterritorial structure as GDPR. */
  saudiPdpl: boolean;
  /** Triggered by UAE establishment (mainland or any free zone OTHER than DIFC/ADGM, both separately exempt under Article 2(2)) OR offering goods/services to UAE-resident individuals — same two-trigger structure as GDPR/Saudi PDPL. */
  uaePdpl: boolean;
  /** Establishment-ONLY, confirmed by research — triggered by ADGM registration specifically. No extraterritorial trigger exists for this regime. */
  adgmDpr: boolean;
}

export function computeJurisdictionApplicability(company: CompanyJurisdictionInput): JurisdictionApplicability {
  const registration = company.registrationCountry !== null ? normalize(company.registrationCountry) : null;
  const customerMarkets = company.customerMarketCountries.map(normalize);

  const registeredInUk = registration !== null && UK_NAMES.has(registration);
  const registeredInEu = registration !== null && EU_MEMBER_STATES.has(registration);
  const registeredInSaudi = registration !== null && SAUDI_ARABIA_NAMES.has(registration);
  const registeredInUae = registration !== null && UAE_NAMES.has(registration);
  const hasUkCustomers = customerMarkets.some((c) => UK_NAMES.has(c));
  const hasEuCustomers = customerMarkets.some((c) => EU_MEMBER_STATES.has(c));
  const hasSaudiCustomers = customerMarkets.some((c) => SAUDI_ARABIA_NAMES.has(c));
  const hasUaeCustomers = customerMarkets.some((c) => UAE_NAMES.has(c));

  // Federal PDPL's establishment trigger excludes DIFC/ADGM specifically
  // (Article 2(2) exemption for free zones with their own DP law) — a
  // company registered in either is establishment-exempt from the
  // FEDERAL law, though it can still be caught by the extraterritorial
  // prong below if it has real UAE customers.
  const registeredInUaeUnderFederalPdpl = registeredInUae && company.uaeFreeZone !== "difc" && company.uaeFreeZone !== "adgm";

  return {
    ukGdpr: registeredInUk || hasUkCustomers,
    euGdpr: registeredInEu || hasEuCustomers,
    saudiPdpl: registeredInSaudi || hasSaudiCustomers,
    uaePdpl: registeredInUaeUnderFederalPdpl || hasUaeCustomers,
    adgmDpr: registeredInUae && company.uaeFreeZone === "adgm",
  };
}

/** True if none of the tracked regimes apply — a company entirely outside this module's current scope. */
export function hasNoApplicableRegulations(applicability: JurisdictionApplicability): boolean {
  return !applicability.ukGdpr && !applicability.euGdpr && !applicability.saudiPdpl && !applicability.uaePdpl && !applicability.adgmDpr;
}
