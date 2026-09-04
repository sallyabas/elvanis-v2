/**
 * Deterministic jurisdiction applicability for Data Protection Compliance
 * (spec §1.8d, confirmed 2026-08-02; extended 2026-08-03 with Saudi PDPL;
 * extended 2026-09-03 with UAE federal PDPL + ADGM DPR 2021; extended
 * again 2026-09-04 with DIFC Data Protection Law No. 5 of 2020) —
 * computed in code, never AI-judged. Same reasoning as Tender Readiness's
 * jurisdiction.ts.
 *
 * GDPR-first build order (spec §1.8a), Saudi PDPL added 2026-08-03 as a
 * real branch (already actively enforced, not gated on future Gulf entry).
 * The UAE's own data-protection regime was the one piece still explicitly
 * gated ("genuinely gated on real UAE client exposure") — that gate was
 * confirmed lifted 2026-09-03, and all three real UAE-adjacent regimes
 * (federal PDPL, ADGM DPR 2021, and now DIFC's own law) are built.
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
 * DIFC (its own separate DIFC Data Protection Law No. 5 of 2020, built
 * here) and ADGM (DPR 2021, built here) both qualify. `uaePdpl`'s
 * establishment prong is therefore deliberately scoped to mainland UAE
 * registration and any UAE free zone OTHER than DIFC/ADGM — not "any UAE
 * registration" — while its extraterritorial prong (UAE-resident
 * customers) fires regardless of where the company itself is registered,
 * same as every other regime here.
 *
 * DIFC Data Protection Law No. 5 of 2020 (built 2026-09-04, real research,
 * not recalled from training data):
 * https://www.akingump.com/en/insights/alerts/new-difc-data-protection-law-in-force-what-you-need-to-know,
 * https://assets.difc.com/v1/media/edge/images/dubaiintern0078-difcexperie96c5-production-3253/media/project/difcexperiences/difc/difcwebsite/documents/laws--regulations/data-protection-law.pdf,
 * https://www.pwc.com/m1/en/services/consulting/technology/cyber-security/navigating-data-privacy-regulations/difc-data-protection-law-uae.html.
 * Confirmed establishment-based (DIFC incorporation) — modeled here the
 * same registration-only way as ADGM. Its own enforcement authority
 * (Commissioner of Data Protection, DIFC) and own adequacy-jurisdiction
 * list for cross-border transfers, genuinely distinct from every other
 * regime this module covers.
 *
 * Real, disclosed limitation, not silently smoothed over: DIFC's law also
 * has a narrower, extraterritorial-ADJACENT concept — an entity processing
 * data *within* DIFC "as part of stable arrangements," even without formal
 * DIFC incorporation (the law's own drafting explicitly notes its reach is
 * "not as expansive as GDPR," so this is not a customer-market-style
 * trigger). This can't be captured by `uaeFreeZone` (a registration field,
 * not an operational-presence one) — closed instead by a dedicated client
 * question (`companies.difc_stable_arrangements`, confirmed 2026-09-04),
 * asked directly rather than inferred, with an honest "not sure" path
 * routing to reviewer follow-up. `difcDpl` below reflects registration
 * only; the stable-arrangements answer is surfaced separately to the
 * reviewer (see /company/[companyId]) rather than folded into this
 * deterministic flag, since it's a genuinely different, self-reported
 * signal, not something code can compute from registration/customer-market
 * data the way every other flag here is computed.
 *
 * "Federal nexus" — mixed onshore + free-zone entities (confirmed correct
 * 2026-09-04, real research, not a code change): multiple independent
 * sources confirm a UAE free-zone-established company (DIFC or ADGM) that
 * ALSO has genuine onshore UAE activity (e.g. recruiting staff onshore) is
 * typically subject to BOTH federal PDPL (for its onshore activity) AND
 * its free-zone law (for its free-zone activity) simultaneously — a real,
 * common structure, not a rare edge case:
 * https://www.dlapiperdataprotection.com/countries/uae-general/law.html,
 * https://www.pinsentmasons.com/out-law/guides/business-in-the-uae-navigating-data-protection-regime,
 * https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/uae/trends-and-developments/O24528.
 * This was ALREADY correctly implemented before this research, not a new
 * branch: Article 2(2)'s exemption only ever applied to `uaePdpl`'s
 * ESTABLISHMENT prong (`registeredInUaeUnderFederalPdpl`, below) — the
 * extraterritorial prong (`hasUaeCustomers`) has always been independent
 * of free-zone registration, so a DIFC- or ADGM-registered company with
 * real UAE customers already correctly gets BOTH its free-zone flag AND
 * `uaePdpl: true`. What an earlier pass called a "disclosed conservative
 * simplification" for the ADGM-plus-UAE-customers test case was actually
 * already-correct legal reasoning — this research confirms it, it doesn't
 * change it. The same mechanism now extends to DIFC automatically, with
 * zero new branching, purely because `difcDpl` and `uaePdpl` are computed
 * independently below (see the "all three UAE regimes simultaneously" test
 * case in jurisdiction.test-cases.ts).
 *
 * Deliberately out of scope, a different pattern from federal nexus: a
 * "group structure" (multiple SEPARATE legal entities — e.g. a mainland
 * LLC plus a DIFC subsidiary — each subject to their own regime). This
 * app's data model is one company profile per account (`companies.
 * registration_country`/`uae_free_zone` are singular, not per-entity), so
 * multi-entity groups aren't representable here at all — a real, distinct
 * boundary from the single-entity federal-nexus case above, not silently
 * conflated with it.
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
  /** Triggered by UAE establishment (mainland or any free zone OTHER than DIFC/ADGM, both separately exempt under Article 2(2)) OR offering goods/services to UAE-resident individuals — same two-trigger structure as GDPR/Saudi PDPL. Independent of DIFC/ADGM registration for its extraterritorial prong — see the "federal nexus" docblock section above. */
  uaePdpl: boolean;
  /** Establishment-ONLY, confirmed by research — triggered by ADGM registration specifically. No extraterritorial trigger exists for this regime. */
  adgmDpr: boolean;
  /** Establishment-ONLY, confirmed by research — triggered by DIFC registration specifically. Does not capture DIFC's own narrower "stable arrangements" extraterritorial-adjacent concept — see this file's own docblock and companies.difc_stable_arrangements. */
  difcDpl: boolean;
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
  // prong below if it has real UAE customers (the "federal nexus"
  // pattern — see this file's own docblock).
  const registeredInUaeUnderFederalPdpl = registeredInUae && company.uaeFreeZone !== "difc" && company.uaeFreeZone !== "adgm";

  return {
    ukGdpr: registeredInUk || hasUkCustomers,
    euGdpr: registeredInEu || hasEuCustomers,
    saudiPdpl: registeredInSaudi || hasSaudiCustomers,
    uaePdpl: registeredInUaeUnderFederalPdpl || hasUaeCustomers,
    adgmDpr: registeredInUae && company.uaeFreeZone === "adgm",
    difcDpl: registeredInUae && company.uaeFreeZone === "difc",
  };
}

/** True if none of the tracked regimes apply — a company entirely outside this module's current scope. */
export function hasNoApplicableRegulations(applicability: JurisdictionApplicability): boolean {
  return (
    !applicability.ukGdpr &&
    !applicability.euGdpr &&
    !applicability.saudiPdpl &&
    !applicability.uaePdpl &&
    !applicability.adgmDpr &&
    !applicability.difcDpl
  );
}
