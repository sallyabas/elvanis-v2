/**
 * Committed test-case suite for computeJurisdictionApplicability (spec
 * §1.8b, confirmed 2026-08-02) — "before trusting this in production, build
 * a real test-case suite... run these and confirm the output matches what
 * a compliance-literate reviewer would expect, not just that the code runs
 * clean." No test framework exists in this project yet; this is a plain,
 * runnable, committed script (not a scratch file) — run with:
 *   npx tsx --env-file=.env.local src/lib/modules/tender-readiness/jurisdiction.test-cases.ts
 * Exits non-zero on any failure so it can be re-run as a real regression
 * check whenever this logic changes, not just once at build time.
 */
import { computeJurisdictionApplicability, hasNoApplicableSections, type CompanyJurisdictionInput, type JurisdictionApplicability } from "./jurisdiction";

interface TestCase {
  name: string;
  input: CompanyJurisdictionInput;
  expected: JurisdictionApplicability;
}

const CASES: TestCase[] = [
  {
    name: "UK-registered, Saudi customers → Saudi AI governance only, not DIFC, not EU AI Act",
    input: { registrationCountry: "UK", uaeFreeZone: null, customerMarketCountries: ["Saudi Arabia"] },
    expected: { euAiAct: false, uaeDifcReg10: false, saudiAiGovernance: true, uaeAiCharterReference: false },
  },
  {
    name: "DIFC-registered, no Gulf/EU customers → DIFC Reg 10 only, not EU AI Act, not Saudi",
    input: { registrationCountry: "UAE", uaeFreeZone: "difc", customerMarketCountries: ["UK"] },
    expected: { euAiAct: false, uaeDifcReg10: true, saudiAiGovernance: false, uaeAiCharterReference: true },
  },
  {
    name: "UK-registered, EU (Germany) customers → EU AI Act only",
    input: { registrationCountry: "UK", uaeFreeZone: null, customerMarketCountries: ["Germany"] },
    expected: { euAiAct: true, uaeDifcReg10: false, saudiAiGovernance: false, uaeAiCharterReference: false },
  },
  {
    name: "UAE mainland-registered, EU customers → EU AI Act + AI Charter reference, not DIFC (not DIFC zone)",
    input: { registrationCountry: "UAE", uaeFreeZone: "mainland", customerMarketCountries: ["France"] },
    expected: { euAiAct: true, uaeDifcReg10: false, saudiAiGovernance: false, uaeAiCharterReference: true },
  },
  {
    name: "ADGM-registered, no other markets → AI Charter reference only, not DIFC (ADGM has no AI-specific regime), not EU, not Saudi",
    input: { registrationCountry: "UAE", uaeFreeZone: "adgm", customerMarketCountries: [] },
    expected: { euAiAct: false, uaeDifcReg10: false, saudiAiGovernance: false, uaeAiCharterReference: true },
  },
  {
    name: "DIFC-registered + EU customers + Saudi customers → all four apply simultaneously",
    input: { registrationCountry: "UAE", uaeFreeZone: "difc", customerMarketCountries: ["Netherlands", "Saudi Arabia"] },
    expected: { euAiAct: true, uaeDifcReg10: true, saudiAiGovernance: true, uaeAiCharterReference: true },
  },
  {
    name: "UK-registered, UK-only customers → nothing applies (baseline no-jurisdiction case)",
    input: { registrationCountry: "UK", uaeFreeZone: null, customerMarketCountries: ["UK"] },
    expected: { euAiAct: false, uaeDifcReg10: false, saudiAiGovernance: false, uaeAiCharterReference: false },
  },
  {
    name: "Case-insensitivity / whitespace: '  united arab emirates ' + '  saudi arabia  ' customer still match",
    input: { registrationCountry: "  United Arab Emirates ", uaeFreeZone: "difc", customerMarketCountries: ["  Saudi Arabia  "] },
    expected: { euAiAct: false, uaeDifcReg10: true, saudiAiGovernance: true, uaeAiCharterReference: true },
  },
  {
    name: "No registration country set, no customer markets → nothing applies, no crash on null",
    input: { registrationCountry: null, uaeFreeZone: null, customerMarketCountries: [] },
    expected: { euAiAct: false, uaeDifcReg10: false, saudiAiGovernance: false, uaeAiCharterReference: false },
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

  // Sanity check on the helper too, using the last case (nothing applies).
  const noneApply = computeJurisdictionApplicability(CASES[CASES.length - 1].input);
  const helperOk = hasNoApplicableSections(noneApply) === true;
  console.log(helperOk ? "PASS — hasNoApplicableSections() agrees on the baseline no-jurisdiction case" : "FAIL — hasNoApplicableSections() disagreed");
  if (!helperOk) failures++;

  console.log(`\n${CASES.length + 1 - failures}/${CASES.length + 1} passed.`);
  if (failures > 0) process.exit(1);
}

main();
