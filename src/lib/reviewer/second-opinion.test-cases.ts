/**
 * Committed test-case suite for the reviewer second-opinion feature's
 * deterministic logic (confirmed 2026-09-04, direct founder requirement:
 * "do not consider this done until the test suite passes," same
 * discipline as misclassification-guard.ts). Run with:
 *   npx tsx --env-file=.env.local src/lib/reviewer/second-opinion.test-cases.ts
 * Exits non-zero on any failure.
 *
 * HONEST SCOPE, disclosed rather than glossed over: this suite tests the
 * three things that ARE genuinely deterministic and testable without a
 * live model call — normalizeSecondOpinionResponse() (the backstop),
 * buildSecondOpinionUserMessage()/buildSecondOpinionSystemPrompt() (prompt
 * construction, i.e. "does the model actually receive the finding's real
 * content and the real rubric, with nothing dropped or mangled"), and a
 * fixture/prompt consistency check. It does NOT and CANNOT verify whether
 * Claude's own judgment is any good — no ANTHROPIC_API_KEY exists in this
 * environment yet. That is a real, separate, later verification step once
 * a key is supplied — never assumed or faked here.
 */
import {
  normalizeSecondOpinionResponse,
  buildSecondOpinionUserMessage,
  buildSecondOpinionSystemPrompt,
  SECOND_OPINION_CATEGORIES,
  type SecondOpinionCategory,
} from "./second-opinion";
import { FINANCIAL_LENS_RUBRIC } from "@/lib/lenses/financial";
import type { LensFinding } from "@/lib/lenses/types";

function baseFinding(overrides: Partial<LensFinding>): LensFinding {
  return {
    findingId: "test",
    title: "Test finding",
    diagnosis: "diagnosis",
    rootCause: "root cause",
    recommendedAction: "action",
    severity: "high",
    evidenceCited: [],
    goalRelevance: "directly_blocks",
    financialImpact: null,
    confidenceLevel: "high",
    isMissingDataFinding: false,
    ...overrides,
  };
}

let failures = 0;
function check(name: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`PASS — ${name}`);
  } else {
    failures++;
    console.log(`FAIL — ${name}${detail ? ` (${detail})` : ""}`);
  }
}

// ---- 1. normalizeSecondOpinionResponse() — the deterministic backstop ----

{
  const r = normalizeSecondOpinionResponse({ concern: false, category: "possible_duplicate", reasoning: "looks fine" });
  check(
    "concern=false with a category set anyway → category forced to null (backstop overrides the model)",
    r.concern === false && r.category === null && r.reasoning === "looks fine",
    JSON.stringify(r),
  );
}
{
  const r = normalizeSecondOpinionResponse({ concern: true, category: "unactionable_recommendation", reasoning: "too vague" });
  check(
    "concern=true with a valid, real category → passed through unchanged",
    r.concern === true && r.category === "unactionable_recommendation" && r.reasoning === "too vague",
    JSON.stringify(r),
  );
}
{
  const r = normalizeSecondOpinionResponse({ concern: true, category: "some_hallucinated_value", reasoning: "x" });
  check(
    "concern=true with an unrecognized/hallucinated category string → normalized to 'other'",
    r.concern === true && r.category === "other",
    JSON.stringify(r),
  );
}
{
  const r = normalizeSecondOpinionResponse({ concern: true, category: null, reasoning: "x" });
  check(
    "concern=true with category explicitly null → normalized to 'other', never surfaced as a concern with nothing to show",
    r.concern === true && r.category === "other",
    JSON.stringify(r),
  );
}
{
  const r = normalizeSecondOpinionResponse({ concern: true, reasoning: "x" });
  check(
    "concern=true with category entirely absent from the response → normalized to 'other'",
    r.concern === true && r.category === "other",
    JSON.stringify(r),
  );
}
{
  const r = normalizeSecondOpinionResponse({ concern: false, reasoning: "no concerns" });
  check(
    "concern=false with no category given at all → stays null, reasoning preserved",
    r.concern === false && r.category === null && r.reasoning === "no concerns",
    JSON.stringify(r),
  );
}

// ---- 2. buildSecondOpinionUserMessage() — nothing dropped or mangled ----

{
  const f = baseFinding({
    title: "Gross margin below healthy range",
    diagnosis: "Gross margin is 58%, below the 60% concerning threshold.",
    rootCause: "Hosting costs grew faster than revenue.",
    recommendedAction: "Renegotiate the hosting contract before renewal next month.",
    severity: "high",
    confidenceLevel: "high",
    goalRelevance: "directly_blocks",
    isMissingDataFinding: false,
    evidenceCited: ["financial.gross_margin_percent", "financial.cost_notes"],
  });
  const msg = buildSecondOpinionUserMessage(f);
  check("user message includes the real title", msg.includes("Gross margin below healthy range"));
  check("user message includes the real diagnosis", msg.includes("Gross margin is 58%, below the 60% concerning threshold."));
  check("user message includes the real root cause", msg.includes("Hosting costs grew faster than revenue."));
  check("user message includes the real recommended action", msg.includes("Renegotiate the hosting contract before renewal next month."));
  check("user message includes severity", msg.includes("Severity: high"));
  check("user message includes confidence level", msg.includes("Confidence level: high"));
  check("user message includes goal relevance", msg.includes("Goal relevance: directly_blocks"));
  check("user message includes isMissingDataFinding", msg.includes("Is missing-data finding: false"));
  check("user message includes both cited evidence keys", msg.includes("financial.gross_margin_percent, financial.cost_notes"));
}
{
  const f = baseFinding({ evidenceCited: [] });
  const msg = buildSecondOpinionUserMessage(f);
  check("empty evidenceCited renders an honest '(none listed)' rather than a blank/misleading string", msg.includes("(none listed)"));
}

// ---- 3. buildSecondOpinionSystemPrompt() — the real rubric, not a re-derived one ----

{
  const prompt = buildSecondOpinionSystemPrompt("Financial", FINANCIAL_LENS_RUBRIC);
  check("system prompt embeds the lens label", prompt.includes("Financial lens"));
  check(
    "system prompt embeds the EXACT financial rubric text verbatim (same string the lens itself drafts against, not a paraphrase)",
    prompt.includes(FINANCIAL_LENS_RUBRIC),
  );
  for (const category of SECOND_OPINION_CATEGORIES) {
    check(`system prompt's category list mentions "${category}"`, prompt.includes(`"${category}"`));
  }
  check(
    "system prompt explicitly tells the model a clean pass is a real, useful answer, not something to avoid",
    prompt.toLowerCase().includes("no genuine concern"),
  );
}

// ---- 4. Known-good / known-bad finding fixtures, one per real category ----
//
// Per direct founder request: a hand-built fixture for each new category,
// plus one clean/known-good finding. What's genuinely verifiable here
// without a live model call is (a) every field survives serialization
// into the user message intact, and (b) each category's own definition
// in the system prompt is internally consistent with the failure shape
// its fixture is designed to represent — a fixture/prompt consistency
// check, not a claim that Claude will actually classify these correctly.
// That remains real, disclosed, unverified scope until a live key exists.

interface Fixture {
  name: string;
  finding: LensFinding;
  /** null for the known-good fixture. */
  expectedCategory: SecondOpinionCategory | null;
  /** A substring that should appear in the category's own definition text in the system prompt, confirming the fixture's failure shape matches what the prompt actually asks the model to look for. */
  promptDefinitionMustMention: string | null;
}

const FIXTURES: Fixture[] = [
  {
    name: "Known-good: well-supported, correctly-structured, actionable finding",
    finding: baseFinding({
      title: "Gross margin below healthy range",
      diagnosis: "Gross margin is 58%, below the 60% concerning threshold (healthy range is 70-80%).",
      rootCause: "Hosting and support costs have grown faster than revenue over the last two quarters, per the submitted cost breakdown.",
      recommendedAction:
        "Renegotiate the current hosting contract before its renewal date next month, and cap support headcount growth until margin recovers to at least 65%.",
      severity: "high",
      evidenceCited: ["financial.gross_margin_percent", "financial.cost_notes"],
      goalRelevance: "directly_blocks",
      confidenceLevel: "high",
      isMissingDataFinding: false,
    }),
    expectedCategory: null,
    promptDefinitionMustMention: null,
  },
  {
    name: "Known-bad: possible_duplicate — re-raises a structural gap likely already guaranteed elsewhere",
    finding: baseFinding({
      title: "No Financial Visibility Documentation",
      diagnosis: "No monthly revenue, margin, or runway figures were submitted for this audit.",
      rootCause: "No evidence was provided for this category.",
      recommendedAction: "Submit financial reporting documentation.",
      severity: "high",
      evidenceCited: [],
      goalRelevance: "directly_blocks",
      confidenceLevel: "high",
      isMissingDataFinding: false,
    }),
    expectedCategory: "possible_duplicate",
    promptDefinitionMustMention: "guaranteed to cover separately",
  },
  {
    name: "Known-bad: unsupported_confidence — high confidence stated on thin/vague evidence",
    finding: baseFinding({
      title: "Customer concentration risk",
      diagnosis: "One customer appears to represent a large share of revenue.",
      rootCause: "The client mentioned in passing that their biggest customer is important.",
      recommendedAction: "Diversify the customer base.",
      severity: "critical",
      evidenceCited: ["financial.general_notes"],
      goalRelevance: "directly_blocks",
      confidenceLevel: "high",
      isMissingDataFinding: false,
    }),
    expectedCategory: "unsupported_confidence",
    promptDefinitionMustMention: "higher than the cited evidence actually supports",
  },
  {
    name: "Known-bad: healthy_finding_miscategorized — a genuinely good metric worded as a problem",
    finding: baseFinding({
      title: "Gross margin concern",
      diagnosis: "Gross margin is 76%, comfortably above the 70% healthy threshold.",
      rootCause: "Strong pricing discipline and low direct costs.",
      recommendedAction: "Address the gross margin issue urgently.",
      severity: "critical",
      evidenceCited: ["financial.gross_margin_percent"],
      goalRelevance: "directly_blocks",
      confidenceLevel: "high",
      isMissingDataFinding: false,
    }),
    expectedCategory: "healthy_finding_miscategorized",
    promptDefinitionMustMention: "good/healthy news",
  },
  {
    name: "Known-bad: goal_relevance_mismatch — a real, material, quantified drag marked as unrelated",
    finding: baseFinding({
      title: "Rising hosting and support costs",
      diagnosis:
        "Hosting and support costs have grown from 8% to 14% of revenue over two quarters, directly compressing gross margin under a cash-flow-efficiency goal.",
      rootCause: "Usage-based hosting pricing scaled faster than revenue as customer count grew.",
      recommendedAction: "Renegotiate the hosting contract's pricing tier and audit unused compute resources by end of next month.",
      severity: "high",
      evidenceCited: ["financial.cost_notes"],
      goalRelevance: "unrelated",
      confidenceLevel: "high",
      isMissingDataFinding: false,
    }),
    expectedCategory: "goal_relevance_mismatch",
    promptDefinitionMustMention: "doesn't honestly match",
  },
  {
    name: "Known-bad: unactionable_recommendation — correct diagnosis, vague/dependency-blocked action",
    finding: baseFinding({
      title: "Cash runway below threshold",
      diagnosis: "Cash runway is 5 months, below the 6-month concerning threshold.",
      rootCause: "Burn rate has increased due to a recent hiring round without a matching increase in revenue.",
      recommendedAction: "Improve financial management practices to extend runway.",
      severity: "critical",
      evidenceCited: ["financial.cash_runway_months"],
      goalRelevance: "directly_blocks",
      confidenceLevel: "high",
      isMissingDataFinding: false,
    }),
    expectedCategory: "unactionable_recommendation",
    promptDefinitionMustMention: "too vague",
  },
];

const systemPromptForFixtures = buildSecondOpinionSystemPrompt("Financial", FINANCIAL_LENS_RUBRIC);

for (const fixture of FIXTURES) {
  const msg = buildSecondOpinionUserMessage(fixture.finding);
  check(`${fixture.name} — diagnosis survives serialization intact`, msg.includes(fixture.finding.diagnosis));
  check(`${fixture.name} — recommendedAction survives serialization intact`, msg.includes(fixture.finding.recommendedAction));
  check(`${fixture.name} — goalRelevance survives serialization intact`, msg.includes(`Goal relevance: ${fixture.finding.goalRelevance}`));

  if (fixture.promptDefinitionMustMention) {
    check(
      `${fixture.name} — the system prompt's own "${fixture.expectedCategory}" category definition is consistent with this fixture's failure shape`,
      systemPromptForFixtures.toLowerCase().includes(fixture.promptDefinitionMustMention.toLowerCase()),
    );
  }
}

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
console.log(
  "\nDisclosed, not hidden: this suite proves the deterministic scaffolding (backstop, prompt construction, fixture/prompt consistency) is correct. It does NOT prove Claude will actually classify the 6 fixtures above the way their names suggest — that needs a real ANTHROPIC_API_KEY and a live run, not yet done.",
);
if (failures > 0) process.exit(1);
