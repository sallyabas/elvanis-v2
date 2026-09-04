/**
 * Committed test-case suite for the reviewer report-level second opinion's
 * deterministic logic (confirmed 2026-09-04, same "do not consider this
 * done until the test suite passes" requirement as the per-finding
 * version). Run with:
 *   npx tsx --env-file=.env.local src/lib/reviewer/report-second-opinion.test-cases.ts
 * Exits non-zero on any failure.
 *
 * HONEST SCOPE, disclosed rather than glossed over — same as
 * second-opinion.test-cases.ts: this tests the deterministic scaffolding
 * (ranking-signal computation, prompt construction, the normalization
 * backstop including hallucinated-finding-ID handling, and a fixture/
 * prompt consistency check). It does NOT and CANNOT verify whether
 * Claude's actual judgment is any good — no ANTHROPIC_API_KEY exists in
 * this environment. That is a real, separate, later verification step
 * once a key is supplied.
 */
import {
  normalizeReportSecondOpinionResponse,
  buildReportSecondOpinionUserMessage,
  buildReportSecondOpinionSystemPrompt,
  REPORT_SECOND_OPINION_CATEGORIES,
  type FindingWithRankingSignals,
  type ReportSecondOpinionCategory,
} from "./report-second-opinion";
import { buildFindingsWithSignals } from "./report-second-opinion-workspace";
import { DEFAULT_RECOMMENDATION_LIBRARY } from "@/lib/recommendations/recommendation-library";
import { GOAL_RELEVANCE_WEIGHTS, CONFIDENCE_WEIGHTS } from "@/lib/reports/ranking-rubric";
import type { GoalContext, LensFinding, LensType } from "@/lib/lenses/types";

function baseFinding(overrides: Partial<LensFinding>): LensFinding {
  return {
    findingId: "test",
    title: "Test finding",
    diagnosis: "diagnosis",
    rootCause: "root cause",
    recommendedAction: "action",
    severity: "medium",
    evidenceCited: [],
    goalRelevance: "unrelated",
    financialImpact: null,
    confidenceLevel: "high",
    isMissingDataFinding: false,
    ...overrides,
  };
}

const GOAL: GoalContext = {
  primaryGoal: "cash_flow_margin_efficiency",
  secondaryGoal: null,
  urgencyLevel: "high",
  targetMetric: "Gross margin above 70%",
  timeHorizon: "3 months",
  successDefinition: null,
};

let failures = 0;
function check(name: string, pass: boolean, detail?: string) {
  if (pass) {
    console.log(`PASS — ${name}`);
  } else {
    failures++;
    console.log(`FAIL — ${name}${detail ? ` (${detail})` : ""}`);
  }
}

// ---- 1. buildFindingsWithSignals() — real ranking-score computation ----

{
  const findings = [
    { id: "f1", lens: "financial" as LensType, finding: baseFinding({ goalRelevance: "directly_blocks", confidenceLevel: "high" }) },
    { id: "f2", lens: "financial" as LensType, finding: baseFinding({ goalRelevance: "unrelated", confidenceLevel: "insufficient" }) },
  ];
  const withSignals = buildFindingsWithSignals(findings, DEFAULT_RECOMMENDATION_LIBRARY);
  const expectedF1Score = GOAL_RELEVANCE_WEIGHTS.directly_blocks * 2 + CONFIDENCE_WEIGHTS.high;
  const expectedF2Score = GOAL_RELEVANCE_WEIGHTS.unrelated * 2 + CONFIDENCE_WEIGHTS.insufficient;
  check(
    "buildFindingsWithSignals computes the real ranking score, matching the live formula exactly (directly_blocks/high)",
    withSignals.find((f) => f.id === "f1")?.rankingScore === expectedF1Score,
    JSON.stringify(withSignals.find((f) => f.id === "f1")),
  );
  check(
    "buildFindingsWithSignals computes the real ranking score, matching the live formula exactly (unrelated/insufficient)",
    withSignals.find((f) => f.id === "f2")?.rankingScore === expectedF2Score,
    JSON.stringify(withSignals.find((f) => f.id === "f2")),
  );
}

// ---- 2. normalizeReportSecondOpinionResponse() — the deterministic backstop ----

{
  const r = normalizeReportSecondOpinionResponse(
    { concerns: [{ category: "some_hallucinated_category", findingIds: [], reasoning: "x" }], overallAssessment: "y" },
    [],
  );
  check(
    "an unrecognized category is normalized to 'other'",
    r.concerns.length === 1 && r.concerns[0].category === "other",
    JSON.stringify(r),
  );
}
{
  const r = normalizeReportSecondOpinionResponse(
    { concerns: [{ category: "missing_fix_first_finding", findingIds: ["real-1", "hallucinated-1"], reasoning: "x" }], overallAssessment: "y" },
    ["real-1", "real-2"],
  );
  check(
    "a concern citing one real + one hallucinated finding ID keeps only the real one",
    r.concerns.length === 1 && r.concerns[0].findingIds.length === 1 && r.concerns[0].findingIds[0] === "real-1",
    JSON.stringify(r),
  );
}
{
  const r = normalizeReportSecondOpinionResponse(
    { concerns: [{ category: "missing_fix_first_finding", findingIds: ["hallucinated-1", "hallucinated-2"], reasoning: "x" }], overallAssessment: "y" },
    ["real-1", "real-2"],
  );
  check(
    "a concern citing ONLY hallucinated finding IDs is dropped entirely — same 'zero valid sources' precedent as AI Opportunity Synthesis",
    r.concerns.length === 0,
    JSON.stringify(r),
  );
}
{
  const r = normalizeReportSecondOpinionResponse(
    { concerns: [{ category: "top3_misaligned_with_goal", findingIds: [], reasoning: "a genuinely general observation" }], overallAssessment: "y" },
    ["real-1"],
  );
  check(
    "a concern with genuinely empty findingIds (a general, report-wide observation) is kept, not dropped",
    r.concerns.length === 1 && r.concerns[0].findingIds.length === 0,
    JSON.stringify(r),
  );
}
{
  const r = normalizeReportSecondOpinionResponse(
    {
      concerns: [
        { category: "missing_fix_first_finding", findingIds: ["real-1"], reasoning: "a" },
        { category: "healthy_finding_in_top3", findingIds: ["real-2"], reasoning: "b" },
      ],
      overallAssessment: "y",
    },
    ["real-1", "real-2"],
  );
  check(
    "multiple concerns in one response are each processed independently, both survive",
    r.concerns.length === 2,
    JSON.stringify(r),
  );
}
{
  const r = normalizeReportSecondOpinionResponse({ concerns: [], overallAssessment: "No concerns — Top 3 looks well-aligned." }, ["real-1"]);
  check(
    "a genuinely clean pass (empty concerns) preserves the real overallAssessment text",
    r.concerns.length === 0 && r.overallAssessment === "No concerns — Top 3 looks well-aligned.",
    JSON.stringify(r),
  );
}

// ---- 3. Prompt construction — nothing dropped, numbers can't drift ----

{
  const prompt = buildReportSecondOpinionSystemPrompt();
  for (const category of REPORT_SECOND_OPINION_CATEGORIES) {
    check(`system prompt's category list mentions "${category}"`, prompt.includes(`"${category}"`));
  }
  check(
    "system prompt embeds the REAL directly_blocks weight, read live from ranking-rubric.ts (can't silently drift)",
    prompt.includes(`ranking weight ${GOAL_RELEVANCE_WEIGHTS.directly_blocks}`),
  );
  check(
    "system prompt embeds the REAL confidence weights, read live from ranking-rubric.ts",
    prompt.includes(`"high" = ${CONFIDENCE_WEIGHTS.high}`),
  );
  check("system prompt tells the model not to recompute the already-computed signals", prompt.toLowerCase().includes("must not recompute"));
  check(
    "system prompt explicitly tells the model a clean pass is a real, useful answer",
    prompt.toLowerCase().includes("no genuine concern"),
  );
}

function fw(id: string, finding: LensFinding, rankingScore: number, fixFirst: boolean, cascadeCount = 0): FindingWithRankingSignals {
  return { id, finding, rankingScore, isFixFirstCandidate: fixFirst, cascadeCount };
}

{
  const top3 = [fw("t1", baseFinding({ title: "Rank 1 finding", goalRelevance: "directly_blocks" }), 11, true)];
  const other = [fw("o1", baseFinding({ title: "Excluded finding", goalRelevance: "unrelated" }), 0, false)];
  const msg = buildReportSecondOpinionUserMessage(GOAL, top3, other);
  check("user message embeds the real goal (primary goal label via formatGoalContextForPrompt)", msg.includes("Cash Flow / Margin Efficiency"));
  check("user message embeds the real Top 3 finding's title and id", msg.includes("Rank 1 finding") && msg.includes("[id: t1]"));
  check("user message embeds the real non-Top-3 finding's title and id", msg.includes("Excluded finding") && msg.includes("[id: o1]"));
  check("user message shows the Top 3 finding's already-computed ranking score", msg.includes("Already-computed ranking score: 11"));
  check("user message shows the Top 3 finding's already-computed fix-first flag", msg.includes("Already-computed fix-first candidate: true"));
}
{
  const msg = buildReportSecondOpinionUserMessage(GOAL, [], []);
  check("empty Top 3 renders an honest '(none selected)' rather than a blank section", msg.includes("(none selected)"));
  check(
    "empty other-findings list renders an honest explanation, not a blank section",
    msg.includes("every approved/edited finding on this report is already in the Top 3"),
  );
}

// ---- 4. Known-good / known-bad REPORT-LEVEL fixtures, one per real category ----
//
// Same honest scope as the per-finding suite: what's genuinely verifiable
// here without a live model call is that every fixture's real content
// (title, scores, goal) survives serialization intact, and that each
// category's own definition in the system prompt is internally consistent
// with the failure shape its fixture represents — never a claim that
// Claude will actually classify these correctly.

interface ReportFixture {
  name: string;
  top3: FindingWithRankingSignals[];
  other: FindingWithRankingSignals[];
  expectedCategory: ReportSecondOpinionCategory | null;
  promptDefinitionMustMention: string | null;
}

const REPORT_FIXTURES: ReportFixture[] = [
  {
    name: "Known-good: Top 3 correctly reflects the highest-scoring, goal-relevant problems; nothing more deserving was left out",
    top3: [
      fw("g1", baseFinding({ title: "Severe cash runway shortfall", severity: "critical", goalRelevance: "directly_blocks", confidenceLevel: "high" }), 11, true),
      fw("g2", baseFinding({ title: "Rising hosting costs eroding margin", severity: "high", goalRelevance: "directly_affects", confidenceLevel: "high" }), 9, true),
      fw("g3", baseFinding({ title: "Customer concentration risk", severity: "medium", goalRelevance: "directly_affects", confidenceLevel: "medium" }), 8, false),
    ],
    other: [fw("g4", baseFinding({ title: "Minor onboarding friction", severity: "low", goalRelevance: "indirectly_affects", confidenceLevel: "low" }), 3, false)],
    expectedCategory: null,
    promptDefinitionMustMention: null,
  },
  {
    name: "Known-bad: missing_fix_first_finding — a critical, directly_blocks finding sits OUTSIDE the Top 3 while lower-scoring findings are in it",
    top3: [
      fw("b1", baseFinding({ title: "Minor pricing inconsistency", severity: "low", goalRelevance: "indirectly_affects", confidenceLevel: "medium" }), 4, false),
      fw("b2", baseFinding({ title: "Slow support ticket resolution", severity: "medium", goalRelevance: "unrelated", confidenceLevel: "high" }), 3, false),
    ],
    other: [
      fw(
        "b3",
        baseFinding({ title: "Runway below 2 months, imminent cash crisis", severity: "critical", goalRelevance: "directly_blocks", confidenceLevel: "high" }),
        11,
        true,
      ),
    ],
    expectedCategory: "missing_fix_first_finding",
    promptDefinitionMustMention: "genuinely NOT in the Top 3",
  },
  {
    name: "Known-bad: healthy_finding_in_top3 — a genuinely healthy (directly_supports) finding sits in the Top 3 as if it were a priority",
    top3: [
      fw("h1", baseFinding({ title: "Gross margin comfortably above benchmark", severity: "low", goalRelevance: "directly_supports", confidenceLevel: "high" }), 7, false),
    ],
    other: [
      fw(
        "h2",
        baseFinding({ title: "Real customer-concentration exposure", severity: "high", goalRelevance: "directly_affects", confidenceLevel: "low" }),
        7,
        false,
      ),
    ],
    expectedCategory: "healthy_finding_in_top3",
    promptDefinitionMustMention: "numerically outscore",
  },
  {
    name: "Known-bad: top3_misaligned_with_goal — Top 3 is full of unrelated/indirect findings while a directly_blocks finding sits outside",
    top3: [
      fw("m1", baseFinding({ title: "Unrelated tooling preference", severity: "medium", goalRelevance: "unrelated", confidenceLevel: "high" }), 3, false),
      fw("m2", baseFinding({ title: "Tangential process note", severity: "medium", goalRelevance: "indirectly_affects", confidenceLevel: "high" }), 5, false),
    ],
    other: [
      fw(
        "m3",
        baseFinding({ title: "The actual primary obstruction of the stated goal", severity: "critical", goalRelevance: "directly_blocks", confidenceLevel: "high" }),
        11,
        true,
      ),
    ],
    expectedCategory: "top3_misaligned_with_goal",
    promptDefinitionMustMention: "doesn't reflect the client's stated goal",
  },
  {
    name: "Known-bad: recommendations_dont_match_goal — Top 3's own recommendedAction text doesn't coherently point at the stated (cash-flow/margin) goal",
    top3: [
      fw(
        "r1",
        baseFinding({
          title: "Product roadmap sequencing is unpredictable",
          severity: "high",
          goalRelevance: "directly_blocks",
          confidenceLevel: "high",
          recommendedAction: "Adopt a new sprint-planning tool and reorganize the product backlog by theme.",
        }),
        11,
        true,
      ),
    ],
    other: [],
    expectedCategory: "recommendations_dont_match_goal",
    promptDefinitionMustMention: "don't add up to genuine progress",
  },
];

for (const fixture of REPORT_FIXTURES) {
  const msg = buildReportSecondOpinionUserMessage(GOAL, fixture.top3, fixture.other);
  for (const f of [...fixture.top3, ...fixture.other]) {
    check(`${fixture.name} — finding "${f.finding.title}" survives serialization intact`, msg.includes(f.finding.title) && msg.includes(`[id: ${f.id}]`));
  }

  if (fixture.promptDefinitionMustMention) {
    const systemPrompt = buildReportSecondOpinionSystemPrompt();
    check(
      `${fixture.name} — the system prompt's own "${fixture.expectedCategory}" category definition is consistent with this fixture's failure shape`,
      systemPrompt.toLowerCase().includes(fixture.promptDefinitionMustMention.toLowerCase()),
    );
  }
}

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
console.log(
  "\nDisclosed, not hidden: this suite proves the deterministic scaffolding (ranking-signal computation, backstop, prompt construction, fixture/prompt consistency) is correct. It does NOT prove Claude will actually classify the 5 fixtures above the way their names suggest — that needs a real ANTHROPIC_API_KEY and a live run, not yet done.",
);
if (failures > 0) process.exit(1);
