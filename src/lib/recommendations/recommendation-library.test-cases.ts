/**
 * Committed test-case suite for matchRecommendationLibraryEntries
 * (confirmed 2026-08-06, ahead of migrating RECOMMENDATION_LIBRARY to the
 * DB) — same test-first precedent as the lens benchmarks. Tests the pure
 * function directly against DEFAULT_RECOMMENDATION_LIBRARY — no DB
 * dependency. Covers a positive match per entry, cross-lens isolation, the
 * two real false-positive bugs already found and fixed live (2026-08-06:
 * bare "margin" matching a HEALTHY margin finding; the direction-agnostic
 * "below what we'd expect" phrase), and result ordering by match count. Run
 * with:
 *   npx tsx --env-file=.env.local src/lib/recommendations/recommendation-library.test-cases.ts
 */
import { matchRecommendationLibraryEntries, DEFAULT_RECOMMENDATION_LIBRARY, type IssueTypeKey } from "./recommendation-library";
import type { LensType } from "@/lib/lenses/types";

function main() {
  let failures = 0;

  function check(name: string, condition: boolean) {
    console.log(condition ? `PASS — ${name}` : `FAIL — ${name}`);
    if (!condition) failures++;
  }

  // ── One positive match per entry ──────────────────────────────────────
  interface PositiveCase {
    name: string;
    lens: LensType;
    title: string;
    diagnosis: string;
    expectedKey: IssueTypeKey;
  }
  const positiveCases: PositiveCase[] = [
    { name: "no_financial_visibility matches", lens: "financial", title: "No financial visibility", diagnosis: "The team has no visibility into monthly numbers.", expectedKey: "no_financial_visibility" },
    { name: "customer_concentration matches", lens: "financial", title: "Revenue concentrated in top customer", diagnosis: "The largest customer accounts for 60% of ARR.", expectedKey: "customer_concentration" },
    { name: "thin_margin matches specific phrase", lens: "financial", title: "Gross margin compression", diagnosis: "Margin is below the healthy range and showing margin compression.", expectedKey: "thin_margin" },
    { name: "short_runway matches", lens: "financial", title: "Short runway", diagnosis: "Only 4 months of runway remain at current burn rate.", expectedKey: "short_runway" },
    { name: "decision_latency matches", lens: "execution", title: "Approval chain adds delay", diagnosis: "Decisions get stuck waiting for approval for weeks.", expectedKey: "decision_latency" },
    { name: "meeting_overload matches", lens: "execution", title: "Meeting overload", diagnosis: "Leadership meeting load is eating into execution time.", expectedKey: "meeting_overload" },
    { name: "no_operating_reporting matches", lens: "execution", title: "No CRM in place", diagnosis: "The company has no reporting and no dashboard for operating maturity.", expectedKey: "no_operating_reporting" },
    { name: "low_feature_adoption matches", lens: "product", title: "Low core feature adoption", diagnosis: "Adoption is well below the industry benchmark.", expectedKey: "low_feature_adoption" },
    { name: "high_churn matches", lens: "product", title: "High churn", diagnosis: "Customers are churning at an elevated rate, driving cancellations.", expectedKey: "high_churn" },
    { name: "weak_onboarding_activation matches", lens: "product", title: "Weak onboarding", diagnosis: "New users take too long to reach first value; time to value is high.", expectedKey: "weak_onboarding_activation" },
    { name: "pricing_pressure matches", lens: "commercial", title: "Pricing pressure", diagnosis: "The client is being forced to discount due to undercutting from a competitor.", expectedKey: "pricing_pressure" },
    { name: "weak_differentiation matches", lens: "commercial", title: "No clear differentiator", diagnosis: "The client cannot articulate how they differentiate from the named competitor.", expectedKey: "weak_differentiation" },
    { name: "recurring_lost_deal_pattern matches", lens: "commercial", title: "Recurring lost deal pattern", diagnosis: "Several deals were lost to the same named competitor this quarter.", expectedKey: "recurring_lost_deal_pattern" },
    { name: "no_ai_governance_docs matches", lens: "ai_governance", title: "No AI governance documentation", diagnosis: "There is no AI use inventory and no documented governance gap remediation.", expectedKey: "no_ai_governance_docs" },
    { name: "no_human_oversight matches", lens: "ai_governance", title: "No human oversight", diagnosis: "AI outputs reach customers without review.", expectedKey: "no_human_oversight" },
    { name: "unclear_ai_risk_classification matches", lens: "ai_governance", title: "Unclear risk classification", diagnosis: "AI use cases are not classified against any risk classification framework.", expectedKey: "unclear_ai_risk_classification" },
  ];

  for (const c of positiveCases) {
    const results = matchRecommendationLibraryEntries(DEFAULT_RECOMMENDATION_LIBRARY, c.lens, c.title, c.diagnosis);
    check(c.name, results.some((r) => r.key === c.expectedKey));
  }

  // ── Cross-lens isolation: a keyword match under the wrong lens must not surface ──
  const wrongLensResults = matchRecommendationLibraryEntries(DEFAULT_RECOMMENDATION_LIBRARY, "financial", "Customers churning", "High churn and cancellations this quarter.");
  check("high_churn (product lens) does not match when queried under financial lens", !wrongLensResults.some((r) => r.key === "high_churn"));

  // ── No match on unrelated/healthy text ────────────────────────────────
  const noMatch = matchRecommendationLibraryEntries(DEFAULT_RECOMMENDATION_LIBRARY, "financial", "Team morale", "The team reports feeling positive about culture and collaboration this quarter.");
  check("unrelated text with no matching keywords returns empty array", noMatch.length === 0);

  // ── Regression: the real false-positive bug found and fixed 2026-08-06 ──
  // Bare "margin" used to match a HEALTHY margin finding — fixed by requiring
  // specific multi-word phrases (margin below/thin margin/compression/erosion).
  const healthyMargin = matchRecommendationLibraryEntries(
    DEFAULT_RECOMMENDATION_LIBRARY,
    "financial",
    "Gross Margin Health",
    "Gross margin is at 76%, which is at/above the healthy range floor of 70%",
  );
  check("healthy 76% margin finding does NOT match thin_margin (the exact live-caught false positive)", !healthyMargin.some((r) => r.key === "thin_margin"));

  // Regression: the direction-agnostic "below what we'd expect" phrase was
  // preemptively removed from low_feature_adoption's keywords for the same reason.
  const healthyAdoption = matchRecommendationLibraryEntries(
    DEFAULT_RECOMMENDATION_LIBRARY,
    "product",
    "Feature Adoption Healthy",
    "Core feature adoption is strong and above what we'd expect for this stage.",
  );
  check("healthy adoption finding does NOT match low_feature_adoption", !healthyAdoption.some((r) => r.key === "low_feature_adoption"));

  // ── Ordering: more matched keywords sorts first ───────────────────────
  // "no visibility into" -> no_financial_visibility, count 1.
  // "concentration" + "top customer" -> customer_concentration, count 2.
  const ordering = matchRecommendationLibraryEntries(
    DEFAULT_RECOMMENDATION_LIBRARY,
    "financial",
    "Revenue concentration",
    "No visibility into which customers drive revenue; concentration in top customer is elevated.",
  );
  const orderingOk = ordering.length >= 2 && ordering[0].key === "customer_concentration" && ordering.some((r) => r.key === "no_financial_visibility");
  check("customer_concentration (2 keyword matches) sorts before no_financial_visibility (1 keyword match)", orderingOk);

  console.log(`\n${positiveCases.length + 5 - failures}/${positiveCases.length + 5} passed.`);
  if (failures > 0) process.exit(1);
}

main();
