/**
 * Committed test-case suite for computeJurisdictionApplicability (spec
 * §1.8d, confirmed 2026-08-02; extended 2026-08-03 with Saudi PDPL cases;
 * extended 2026-09-03 with UAE federal PDPL + ADGM DPR 2021 cases) — same
 * discipline as Tender Readiness's jurisdiction.test-cases.ts: a real,
 * runnable, committed script, not a scratch file. Run with:
 *   npx tsx --env-file=.env.local src/lib/modules/data-protection-compliance/jurisdiction.test-cases.ts
 * Exits non-zero on any failure.
 */
import { computeJurisdictionApplicability, hasNoApplicableRegulations, type CompanyJurisdictionInput, type JurisdictionApplicability } from "./jurisdiction";

interface TestCase {
  name: string;
  input: CompanyJurisdictionInput;
  expected: JurisdictionApplicability;
}

const CASES: TestCase[] = [
  {
    name: "UK-registered company, UK/EU customers → both UK GDPR and EU GDPR apply, not Saudi PDPL or the UAE regimes",
    input: { registrationCountry: "UK", uaeFreeZone: null, customerMarketCountries: ["UK", "Netherlands"] },
    expected: { ukGdpr: true, euGdpr: true, saudiPdpl: false, uaePdpl: false, adgmDpr: false },
  },
  {
    name: "Company with no EU/UK/Saudi/UAE customer exposure and non-EU/UK/Saudi/UAE registration → nothing applies",
    input: { registrationCountry: "United States", uaeFreeZone: null, customerMarketCountries: ["United States", "Canada"] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: false, uaePdpl: false, adgmDpr: false },
  },
  {
    name: "UK-registered, customers only outside EU/UK → UK GDPR still applies via establishment (Article 3(1)), EU GDPR and Saudi PDPL do not",
    input: { registrationCountry: "UK", uaeFreeZone: null, customerMarketCountries: ["United States"] },
    expected: { ukGdpr: true, euGdpr: false, saudiPdpl: false, uaePdpl: false, adgmDpr: false },
  },
  {
    name: "Non-EU/UK-registered company with EU customers → EU GDPR applies via extraterritorial reach (Article 3(2)) despite no EU establishment",
    input: { registrationCountry: "United States", uaeFreeZone: null, customerMarketCountries: ["Germany"] },
    expected: { ukGdpr: false, euGdpr: true, saudiPdpl: false, uaePdpl: false, adgmDpr: false },
  },
  {
    name: "EU-registered (Netherlands), UK customers → both GDPR variants apply (EU via establishment, UK via extraterritorial reach), not Saudi PDPL",
    input: { registrationCountry: "Netherlands", uaeFreeZone: null, customerMarketCountries: ["UK"] },
    expected: { ukGdpr: true, euGdpr: true, saudiPdpl: false, uaePdpl: false, adgmDpr: false },
  },
  {
    name: "UK-registered company, Saudi customers → Saudi PDPL applies via extraterritorial reach alongside UK GDPR via establishment, not EU GDPR (mirrors Tender Readiness's parallel 'UK-registered with Saudi customers' case, but for the data-protection domain instead of AI governance)",
    input: { registrationCountry: "UK", uaeFreeZone: null, customerMarketCountries: ["Saudi Arabia"] },
    expected: { ukGdpr: true, euGdpr: false, saudiPdpl: true, uaePdpl: false, adgmDpr: false },
  },
  {
    name: "Saudi-registered company, no other customer markets → Saudi PDPL applies via establishment alone, no GDPR",
    input: { registrationCountry: "Saudi Arabia", uaeFreeZone: null, customerMarketCountries: [] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: true, uaePdpl: false, adgmDpr: false },
  },
  {
    name: "Non-Saudi/UK/EU-registered company, Saudi customers only → Saudi PDPL applies via extraterritorial reach alone, no establishment trigger",
    input: { registrationCountry: "United States", uaeFreeZone: null, customerMarketCountries: ["Saudi Arabia"] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: true, uaePdpl: false, adgmDpr: false },
  },
  {
    name: "UK-registered company with EU and Saudi customers → all three (pre-existing) regimes apply simultaneously",
    input: { registrationCountry: "UK", uaeFreeZone: null, customerMarketCountries: ["Germany", "Saudi Arabia"] },
    expected: { ukGdpr: true, euGdpr: true, saudiPdpl: true, uaePdpl: false, adgmDpr: false },
  },
  {
    name: "Case-insensitivity / whitespace: '  united kingdom ' registration + '  netherlands  ' + '  saudi arabia  ' customers still match",
    input: { registrationCountry: "  United Kingdom ", uaeFreeZone: null, customerMarketCountries: ["  netherlands  ", "  Saudi Arabia  "] },
    expected: { ukGdpr: true, euGdpr: true, saudiPdpl: true, uaePdpl: false, adgmDpr: false },
  },
  {
    name: "No registration country set, no customer markets → nothing applies, no crash on null",
    input: { registrationCountry: null, uaeFreeZone: null, customerMarketCountries: [] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: false, uaePdpl: false, adgmDpr: false },
  },

  // ---- UAE federal PDPL + ADGM DPR 2021 cases, added 2026-09-03 ----

  {
    name: "UAE mainland-registered company, no other markets → federal PDPL applies via establishment, ADGM DPR does not (not registered there)",
    input: { registrationCountry: "UAE", uaeFreeZone: "mainland", customerMarketCountries: [] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: false, uaePdpl: true, adgmDpr: false },
  },
  {
    name: "DIFC-registered company, no other markets → federal PDPL does NOT apply (Article 2(2) free-zone exemption — DIFC has its own separate, unbuilt regime, deliberately out of scope), ADGM DPR does not apply either (different free zone)",
    input: { registrationCountry: "UAE", uaeFreeZone: "difc", customerMarketCountries: [] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: false, uaePdpl: false, adgmDpr: false },
  },
  {
    name: "ADGM-registered company, no other markets → ADGM DPR applies via establishment, federal PDPL does not (same Article 2(2) exemption, this time for ADGM specifically)",
    input: { registrationCountry: "UAE", uaeFreeZone: "adgm", customerMarketCountries: [] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: false, uaePdpl: false, adgmDpr: true },
  },
  {
    name: "US-registered company with UAE customers only → federal PDPL applies via extraterritorial reach alone, ADGM DPR does not (confirmed establishment-only, no extraterritorial trigger exists for it at all)",
    input: { registrationCountry: "United States", uaeFreeZone: null, customerMarketCountries: ["United Arab Emirates"] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: false, uaePdpl: true, adgmDpr: false },
  },
  {
    name: "UK-registered company with UAE customers alongside UK/EU/Saudi → all four applicable regimes fire together, federal PDPL via extraterritorial reach only (no UAE establishment), ADGM DPR still does not apply",
    input: { registrationCountry: "UK", uaeFreeZone: null, customerMarketCountries: ["UK", "Germany", "Saudi Arabia", "United Arab Emirates"] },
    expected: { ukGdpr: true, euGdpr: true, saudiPdpl: true, uaePdpl: true, adgmDpr: false },
  },
  {
    name: "ADGM-registered company that ALSO lists UAE as a customer market → federal PDPL fires via the extraterritorial prong (a real, disclosed conservative simplification — see jurisdiction.ts's own docblock: research didn't resolve whether Article 2(2)'s establishment exemption is meant to extend to this exact case, so this deliberately flags rather than silently exempts), ADGM DPR still applies via its own establishment trigger",
    input: { registrationCountry: "UAE", uaeFreeZone: "adgm", customerMarketCountries: ["United Arab Emirates"] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: false, uaePdpl: true, adgmDpr: true },
  },
  {
    name: "All five regimes applying simultaneously — UK-registered, customers spanning UK/EU/Saudi/UAE, no UAE establishment",
    input: { registrationCountry: "UK", uaeFreeZone: null, customerMarketCountries: ["United Kingdom", "France", "Saudi Arabia", "UAE"] },
    expected: { ukGdpr: true, euGdpr: true, saudiPdpl: true, uaePdpl: true, adgmDpr: false },
  },
];

function main() {
  let failures = 0;

  for (const testCase of CASES) {
    const actual = computeJurisdictionApplicability(testCase.input);
    const keys = Object.keys(testCase.expected) as (keyof JurisdictionApplicability)[];
    const mismatches = keys.filter((k) => actual[k] !== testCase.expected[k]);

    if (mismatches.length === 0) {
      console.log(`PASS — ${testCase.name}`);
    } else {
      failures++;
      console.log(`FAIL — ${testCase.name}`);
      for (const k of mismatches) {
        console.log(`    ${k}: expected ${testCase.expected[k]}, got ${actual[k]}`);
      }
    }
  }

  // Sanity check on the helper too, using the "nothing applies" case.
  const noneApply = computeJurisdictionApplicability({ registrationCountry: null, uaeFreeZone: null, customerMarketCountries: [] });
  const helperOk = hasNoApplicableRegulations(noneApply) === true;
  console.log(helperOk ? "PASS — hasNoApplicableRegulations() agrees on the baseline no-jurisdiction case" : "FAIL — hasNoApplicableRegulations() disagreed");
  if (!helperOk) failures++;

  console.log(`\n${CASES.length + 1 - failures}/${CASES.length + 1} passed.`);
  if (failures > 0) process.exit(1);
}

main();
