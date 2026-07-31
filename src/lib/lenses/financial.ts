import { z } from "zod";
import { generateValidatedJson } from "@/lib/ai-client";
import { compareFinancialMetric, formatBenchmarksForPrompt } from "./financial-benchmarks";
import { formatGoalContextForPrompt } from "./goals";
import { formatComputedComparisonsForPrompt } from "./metrics";
import {
  confidenceLevelSchema,
  evidenceSufficiencySchema,
  financialImpactSchema,
  goalRelevanceSchema,
} from "./schemas";
import type { EvidenceFieldInput, LensDraftInput, LensDraftResult, LensFinding, LensModule } from "./types";

const SYSTEM_PROMPT = `You are the Financial lens of an AI execution audit for founder-led B2B SaaS and tech-enabled SMEs (20-200 employees, UK/NL first). You analyze submitted financial evidence and produce a structured set of findings — you do not write prose reports.

HARD RULES — violating any of these makes your output unusable:
1. Never fabricate a number that isn't present in the submitted evidence. Every quantified claim must name the specific evidence field(s) it came from in "evidenceCited".
2. Financial impact is always a range (impactBandLow/impactBandHigh) with a confidence level and stated assumptions — never a single fake-precise number. If you cannot responsibly estimate a range, set financialImpact to null rather than inventing one.
3. If evidence for a specific check is missing or too sparse to analyze, do not guess. Reflect that in evidenceSufficiency and isMissingDataFinding, and lower confidenceLevel to "insufficient" — do not manufacture a finding to fill the gap. Vague qualitative claims (e.g. "margins are healthy I believe") are not evidence — treat unverifiable anecdotes the same as missing data, not as grounds for a confident finding.
4. Do NOT diagnose WHY financial data is missing or the company lacks financial visibility/reporting infrastructure (e.g. "no finance function," "immature financial processes," "lack of reporting infrastructure") — that causal diagnosis belongs to the Execution lens, not Financial. If you note insufficient data (rule 3), the rootCause must describe ONLY what evidence is missing or unverifiable (e.g. "No monthly revenue, margin, runway, or concentration figures were submitted; the qualitative claim in the general note cannot be independently verified") — never speculate about organizational causes.
5. Weigh findings by relevance to the client's stated goal (see goalRelevance), but do not suppress materially important findings just because they're "unrelated" to the goal — surface them, just mark them accordingly.
6. COMPUTED BENCHMARK COMPARISONS ARE FINAL — DO NOT RECOMPUTE. Every metric's tier and comparison-to-benchmark below was already calculated in code, in matching units, and is guaranteed correct. Use each "comparisonText" verbatim (or a light rewording that preserves its exact meaning and direction) in the corresponding finding's rootCause. Do NOT independently judge whether a value is above/below/within a benchmark, do NOT convert units yourself, and do NOT second-guess the tier — that arithmetic is not your job here. For any number in the evidence that is NOT in the computed comparisons list, you may discuss it qualitatively but must not assert a specific benchmark comparison for it.
7. Output strict JSON matching the schema below. No prose outside the JSON.

REFERENCE BENCHMARKS (general context on the scale involved — the COMPUTED BENCHMARK COMPARISONS section below is what decides each finding's tier, not this):
${formatBenchmarksForPrompt()}

GOAL-RELEVANCE GUIDANCE (typical financial signals most load-bearing per goal — use judgment, not a rigid lookup):
- Cash Flow / Margin Efficiency: gross/net margin health, runway, burn rate, cost structure
- Growth / Revenue Efficiency: CAC/LTV and payback period, revenue growth rate, pricing/discounting consistency, customer concentration as a growth-risk factor
- Churn / Retention: revenue churn $ impact, customer concentration, contract/renewal terms
- Execution Speed: whether runway/burn constrains hiring or tooling capacity, budget-vs-actual variance
- Product Delivery: R&D/engineering budget allocation and tooling spend relative to delivery capacity

OUTPUT SCHEMA (JSON object):
{
  "findings": [
    {
      "title": string,               // short label, e.g. "Revenue concentrated in 2 clients (61% of ARR)"
      "rootCause": string,           // the underlying mechanism, not just the symptom
      "evidenceCited": string[],     // exact evidence field names/values this is grounded in
      "goalRelevance": "directly_blocks" | "indirectly_affects" | "unrelated",
      "financialImpact": {
        "impactBandLow": number,
        "impactBandHigh": number,
        "currency": string,
        "confidenceLevel": "high" | "medium" | "low" | "insufficient",
        "assumptions": string[]
      } | null,
      "confidenceLevel": "high" | "medium" | "low" | "insufficient",
      "isMissingDataFinding": boolean
    }
  ],
  "evidenceSufficiency": "sufficient" | "partial" | "insufficient",
  "notes": string  // optional, brief
}`;

const financialFindingSchema = z.object({
  title: z.string(),
  rootCause: z.string(),
  evidenceCited: z.array(z.string()),
  goalRelevance: goalRelevanceSchema,
  financialImpact: financialImpactSchema,
  confidenceLevel: confidenceLevelSchema,
  isMissingDataFinding: z.boolean(),
});

const financialLensOutputSchema = z.object({
  findings: z.array(financialFindingSchema),
  evidenceSufficiency: evidenceSufficiencySchema,
  notes: z.string().optional(),
});

type RawFinancialLensOutput = z.infer<typeof financialLensOutputSchema>;

function formatEvidenceForPrompt(fields: EvidenceFieldInput[]): string {
  if (fields.length === 0) return "(none submitted — this does NOT mean no evidence exists; check the computed benchmark comparisons above, which come from separately submitted metrics)";

  return fields
    .map((f) => {
      const value = f.isBlank || f.fieldValue === null ? "(blank)" : f.fieldValue;
      return `- ${f.fieldName}: ${value} [source: ${f.source}]`;
    })
    .join("\n");
}

function buildUserPrompt(input: LensDraftInput): string {
  const { company, goal, evidenceFields, metrics } = input;

  const computedComparisons = metrics
    .map((m) => compareFinancialMetric(m.metricKey, m.value))
    .filter((c) => c !== null);

  return `COMPANY PROFILE:
Name: ${company.name}
Industry: ${company.industry ?? "unknown"}
Business model: ${company.businessModel ?? "unknown"}
Registered in: ${company.registrationCountry ?? "unknown"}
Customer markets: ${company.customerMarketCountries.length > 0 ? company.customerMarketCountries.join(", ") : "unknown"}
Employee count: ${company.employeeCount ?? "unknown"}
Stage: ${company.stage ?? "unknown"}
Revenue range band: ${company.revenueRangeBand ?? "unknown"}
Customer type: ${company.customerType ?? "unknown"}
Team structure: ${company.teamStructureSummary ?? "unknown"}

GOAL CONTEXT:
${formatGoalContextForPrompt(goal)}

COMPUTED BENCHMARK COMPARISONS (already calculated, correct, and final — see rule 6):
${formatComputedComparisonsForPrompt(computedComparisons)}

OTHER FINANCIAL EVIDENCE SUBMITTED (qualitative/narrative context, no benchmark comparison pre-computed):
${formatEvidenceForPrompt(evidenceFields)}

Produce your findings now, following the output schema exactly.`;
}

export const financialLens: LensModule = {
  lens: "financial",

  async runDraft(input: LensDraftInput): Promise<LensDraftResult> {
    const raw: RawFinancialLensOutput = await generateValidatedJson(financialLensOutputSchema, {
      schemaName: "financial-lens",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    });

    const findings: LensFinding[] = raw.findings.map((f, i) => ({
      findingId: `financial-${i}`,
      title: f.title,
      rootCause: f.rootCause,
      evidenceCited: f.evidenceCited,
      goalRelevance: f.goalRelevance,
      financialImpact: f.financialImpact,
      confidenceLevel: f.confidenceLevel,
      isMissingDataFinding: f.isMissingDataFinding,
    }));

    return {
      lens: "financial",
      findings,
      evidenceSufficiency: raw.evidenceSufficiency,
      notes: raw.notes,
    };
  },
};
