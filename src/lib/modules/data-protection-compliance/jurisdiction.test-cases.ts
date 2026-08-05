/**
 * Committed test-case suite for computeJurisdictionApplicability (spec
 * §1.8d, confirmed 2026-08-02; extended 2026-08-03 with Saudi PDPL cases)
 * — same discipline as Tender Readiness's jurisdiction.test-cases.ts: a
 * real, runnable, committed script, not a scratch file. Run with:
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
    name: "UK-registered company, UK/EU customers → both UK GDPR and EU GDPR apply, not Saudi PDPL",
    input: { registrationCountry: "UK", customerMarketCountries: ["UK", "Netherlands"] },
    expected: { ukGdpr: true, euGdpr: true, saudiPdpl: false },
  },
  {
    name: "Company with no EU/UK/Saudi customer exposure and non-EU/UK/Saudi registration → nothing applies",
    input: { registrationCountry: "United States", customerMarketCountries: ["United States", "Canada"] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: false },
  },
  {
    name: "UK-registered, customers only outside EU/UK → UK GDPR still applies via establishment (Article 3(1)), EU GDPR and Saudi PDPL do not",
    input: { registrationCountry: "UK", customerMarketCountries: ["United States"] },
    expected: { ukGdpr: true, euGdpr: false, saudiPdpl: false },
  },
  {
    name: "Non-EU/UK-registered company with EU customers → EU GDPR applies via extraterritorial reach (Article 3(2)) despite no EU establishment",
    input: { registrationCountry: "United States", customerMarketCountries: ["Germany"] },
    expected: { ukGdpr: false, euGdpr: true, saudiPdpl: false },
  },
  {
    name: "EU-registered (Netherlands), UK customers → both GDPR variants apply (EU via establishment, UK via extraterritorial reach), not Saudi PDPL",
    input: { registrationCountry: "Netherlands", customerMarketCountries: ["UK"] },
    expected: { ukGdpr: true, euGdpr: true, saudiPdpl: false },
  },
  {
    name: "UK-registered company, Saudi customers → Saudi PDPL applies via extraterritorial reach alongside UK GDPR via establishment, not EU GDPR (mirrors Tender Readiness's parallel 'UK-registered with Saudi customers' case, but for the data-protection domain instead of AI governance)",
    input: { registrationCountry: "UK", customerMarketCountries: ["Saudi Arabia"] },
    expected: { ukGdpr: true, euGdpr: false, saudiPdpl: true },
  },
  {
    name: "Saudi-registered company, no other customer markets → Saudi PDPL applies via establishment alone, no GDPR",
    input: { registrationCountry: "Saudi Arabia", customerMarketCountries: [] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: true },
  },
  {
    name: "Non-Saudi/UK/EU-registered company, Saudi customers only → Saudi PDPL applies via extraterritorial reach alone, no establishment trigger",
    input: { registrationCountry: "United States", customerMarketCountries: ["Saudi Arabia"] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: true },
  },
  {
    name: "UK-registered company with EU and Saudi customers → all three regimes apply simultaneously",
    input: { registrationCountry: "UK", customerMarketCountries: ["Germany", "Saudi Arabia"] },
    expected: { ukGdpr: true, euGdpr: true, saudiPdpl: true },
  },
  {
    name: "Case-insensitivity / whitespace: '  united kingdom ' registration + '  netherlands  ' + '  saudi arabia  ' customers still match",
    input: { registrationCountry: "  United Kingdom ", customerMarketCountries: ["  netherlands  ", "  Saudi Arabia  "] },
    expected: { ukGdpr: true, euGdpr: true, saudiPdpl: true },
  },
  {
    name: "No registration country set, no customer markets → nothing applies, no crash on null",
    input: { registrationCountry: null, customerMarketCountries: [] },
    expected: { ukGdpr: false, euGdpr: false, saudiPdpl: false },
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
  const noneApply = computeJurisdictionApplicability(CASES[CASES.length - 1].input);
  const helperOk = hasNoApplicableRegulations(noneApply) === true;
  console.log(helperOk ? "PASS — hasNoApplicableRegulations() agrees on the baseline no-jurisdiction case" : "FAIL — hasNoApplicableRegulations() disagreed");
  if (!helperOk) failures++;

  console.log(`\n${CASES.length + 1 - failures}/${CASES.length + 1} passed.`);
  if (failures > 0) process.exit(1);
}

main();
