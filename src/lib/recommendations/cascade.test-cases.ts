/**
 * Committed test-case suite for computeCascadeSignals (confirmed
 * 2026-08-13, item 1 of the old-Elvanis-inspired batch, test-first per this
 * codebase's own standing precedent for benchmark/matching functions).
 * Tests the pure function directly against DEFAULT_RECOMMENDATION_LIBRARY
 * — no DB dependency. Run with:
 *   npx tsx --env-file=.env.local src/lib/recommendations/cascade.test-cases.ts
 */
import { computeCascadeSignals, type FindingForCascade } from "./cascade";
import { DEFAULT_RECOMMENDATION_LIBRARY } from "./recommendation-library";

function main() {
  let failures = 0;

  function check(name: string, condition: boolean) {
    console.log(condition ? `PASS — ${name}` : `FAIL — ${name}`);
    if (!condition) failures++;
  }

  // ── Cross-lens cascade: no_financial_visibility (financial) cascades to thin_margin, short_runway, customer_concentration, no_operating_reporting ──
  const cascadeSet: FindingForCascade[] = [
    { id: "f1", lens: "financial", title: "No financial visibility", diagnosis: "The team has no visibility into monthly numbers." },
    { id: "f2", lens: "financial", title: "Gross margin compression", diagnosis: "Margin is below the healthy range, showing margin compression." },
    { id: "f3", lens: "financial", title: "Short runway", diagnosis: "Only 4 months of runway remain at current burn rate." },
    { id: "f4", lens: "execution", title: "No CRM in place", diagnosis: "The company has no reporting and no dashboard for operating maturity." },
  ];
  const signals = computeCascadeSignals(cascadeSet, DEFAULT_RECOMMENDATION_LIBRARY);
  const f1Signal = signals.get("f1");
  check("no_financial_visibility matched correctly", f1Signal?.matchedIssueType === "no_financial_visibility");
  check("no_financial_visibility cascades to all 3 other present findings (thin_margin, short_runway, no_operating_reporting)", f1Signal?.cascadeCount === 3);
  check("cascadesToFindingTitles lists the real downstream finding titles", (f1Signal?.cascadesToFindingTitles ?? []).includes("Gross margin compression"));

  // A downstream-only finding (short_runway) has no cascadesTo entries of its own — cascadeCount 0.
  const f3Signal = signals.get("f3");
  check("short_runway (a terminal issue type) has cascadeCount 0 even with other findings present", f3Signal?.cascadeCount === 0);

  // ── Threshold: cascade count only counts OTHER findings actually present in this exact set, not a global count ──
  const singleCascade: FindingForCascade[] = [
    { id: "g1", lens: "financial", title: "No financial visibility", diagnosis: "The team has no visibility into monthly numbers." },
    { id: "g2", lens: "financial", title: "Gross margin compression", diagnosis: "Margin is below the healthy range, showing margin compression." },
  ];
  const singleSignals = computeCascadeSignals(singleCascade, DEFAULT_RECOMMENDATION_LIBRARY);
  check("cascade count reflects only findings present in THIS set (1, not the full 4-item map)", singleSignals.get("g1")?.cascadeCount === 1);

  // ── No match: a finding with no library match gets an empty signal, not an error ──
  const noMatchSet: FindingForCascade[] = [{ id: "h1", lens: "financial", title: "Team morale", diagnosis: "The team reports feeling positive about culture and collaboration this quarter." }];
  const noMatchSignals = computeCascadeSignals(noMatchSet, DEFAULT_RECOMMENDATION_LIBRARY);
  const h1Signal = noMatchSignals.get("h1");
  check("unmatched finding gets matchedIssueType null", h1Signal?.matchedIssueType === null);
  check("unmatched finding gets cascadeCount 0", h1Signal?.cascadeCount === 0);

  // ── A finding never counts itself as downstream of itself ──
  const selfSet: FindingForCascade[] = [{ id: "i1", lens: "financial", title: "No financial visibility", diagnosis: "The team has no visibility into monthly numbers." }];
  const selfSignals = computeCascadeSignals(selfSet, DEFAULT_RECOMMENDATION_LIBRARY);
  check("a lone matched finding with no other findings present has cascadeCount 0 (never counts itself)", selfSignals.get("i1")?.cascadeCount === 0);

  // ── A downstream finding matching an unrelated issue type doesn't get miscounted ──
  const irrelevantDownstream: FindingForCascade[] = [
    { id: "j1", lens: "financial", title: "No financial visibility", diagnosis: "The team has no visibility into monthly numbers." },
    { id: "j2", lens: "commercial", title: "Pricing pressure", diagnosis: "The client is being forced to discount due to undercutting from a competitor." },
  ];
  const irrelevantSignals = computeCascadeSignals(irrelevantDownstream, DEFAULT_RECOMMENDATION_LIBRARY);
  check("no_financial_visibility does NOT cascade to an unrelated present finding (pricing_pressure isn't in its cascadesTo list)", irrelevantSignals.get("j1")?.cascadeCount === 0);

  console.log(`\n${9 - failures}/9 passed.`);
  if (failures > 0) process.exit(1);
}

main();
