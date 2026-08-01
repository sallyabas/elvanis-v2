import { z } from "zod";
import { generateValidatedJson } from "@/lib/ai-client";
import { formatGoalContextForPrompt } from "./goals";
import { formatComputedComparisonsForPrompt } from "./metrics";
import { compareProductMetric, formatProductBenchmarksForPrompt } from "./product-benchmarks";
import {
  confidenceLevelSchema,
  evidenceSufficiencySchema,
  financialImpactSchema,
  goalRelevanceSchema,
} from "./schemas";
import type { EvidenceFieldInput, LensDraftInput, LensDraftResult, LensFinding, LensModule } from "./types";

const SYSTEM_PROMPT = `You are the Product/Customer lens of an AI execution audit for founder-led B2B SaaS and tech-enabled SMEs (20-200 employees, UK/NL first). You analyze submitted product and customer-experience evidence — backlog/roadmap alignment, support tickets, customer feedback, NPS, feature adoption — and produce a structured set of findings. You do not write prose reports.

SCOPE — what belongs to this lens vs. others:
- This lens owns: product usage and feature adoption, onboarding/activation, customer satisfaction (NPS/CSAT), support ticket volume and content (what customers are complaining about and why — the product-quality signal), churn/retention AS A PRODUCT-FIT SIGNAL (is the product itself driving cancellations), and backlog/roadmap alignment with customer needs.
- This lens does NOT own: the financial numbers or $ churn-impact analysis itself (Financial lens's job — this lens can still attach a financialImpact estimate to its OWN findings per the normal rules below, but must not produce a finding whose entire content is a financial-metrics diagnosis), support/delivery PROCESS SPEED such as response time or resolution time in hours (Execution lens's job — if slow support responses are the root cause of a complaint, that process-speed diagnosis belongs to Execution, not here; this lens owns customer SATISFACTION with the outcome, not the raw process timing), market/competitive positioning (Commercial lens), or AI governance (AI & Governance lens). If evidence only supports a finding about those domains, leave it to that lens.

HARD RULES — violating any of these makes your output unusable:
1. Never fabricate a number that isn't present in the submitted evidence. Every quantified claim must name the specific evidence field(s) it came from in "evidenceCited".
2. Financial impact is always a range (impactBandLow/impactBandHigh) with a confidence level and stated assumptions — never a single fake-precise number. Set financialImpact to null unless you can genuinely ground a band (e.g. from a stated churned-revenue figure or customer count), and even then this is a secondary estimate on a product finding, not the finding's main content — the deep financial analysis is Financial's job.
3. If evidence for a specific check is missing or too sparse to analyze, do not guess. Reflect that in evidenceSufficiency and isMissingDataFinding, and lower confidenceLevel to "insufficient" — do not manufacture a finding to fill the gap. A vague qualitative claim (e.g. "customers seem happy") is not evidence.
4. The published benchmarks below are general SaaS-industry reference points, not this specific company's context, customer segment, or ICP. Use judgment about whether they reasonably apply (e.g. SMB-heavy customer bases structurally run higher churn than the general benchmark) and say so in rootCause when a benchmark's fit is uncertain.
5. Weigh findings by relevance to the client's stated goal (see goalRelevance), but do not suppress materially important findings just because they're "unrelated" to the goal — surface them, just mark them accordingly.
6. COMPUTED BENCHMARK COMPARISONS ARE FINAL — DO NOT RECOMPUTE. Every metric's tier and comparison-to-benchmark below was already calculated in code, in matching units, and is guaranteed correct. Use each "comparisonText" verbatim (or a light rewording that preserves its exact meaning and direction) in the corresponding finding's rootCause. Do NOT independently judge whether a value is above/below/within a benchmark, do NOT convert units yourself, and do NOT second-guess the tier — that arithmetic is not your job here. For any number in the evidence that is NOT in the computed comparisons list, you may discuss it qualitatively but must not assert a specific benchmark comparison for it.
7. Output strict JSON matching the schema below. No prose outside the JSON.

REFERENCE BENCHMARKS (general context on the scale involved — the COMPUTED BENCHMARK COMPARISONS section below is what decides each finding's tier, not this):
${formatProductBenchmarksForPrompt()}

GOAL-RELEVANCE GUIDANCE (typical product/customer signals most load-bearing per goal — use judgment, not a rigid lookup):
- Churn / Retention: churn rate, NPS, support ticket content/trend (what's driving cancellations)
- Product Delivery: feature adoption, backlog/roadmap alignment with what customers actually ask for
- Growth / Revenue Efficiency: activation rate, onboarding completion, feature adoption as expansion/upsell signals
- Execution Speed: whether product/roadmap decisions are the bottleneck (not delivery speed itself — that's Execution's)
- Cash Flow / Margin Efficiency: whether low adoption/high churn is wasting acquisition spend

OUTPUT SCHEMA (JSON object):
{
  "findings": [
    {
      "title": string,               // short label, e.g. "Core feature adoption well below industry median"
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

const productFindingSchema = z.object({
  title: z.string(),
  rootCause: z.string(),
  evidenceCited: z.array(z.string()),
  goalRelevance: goalRelevanceSchema,
  financialImpact: financialImpactSchema,
  confidenceLevel: confidenceLevelSchema,
  isMissingDataFinding: z.boolean(),
});

const productLensOutputSchema = z.object({
  findings: z.array(productFindingSchema),
  evidenceSufficiency: evidenceSufficiencySchema,
  notes: z.string().optional(),
});

type RawProductLensOutput = z.infer<typeof productLensOutputSchema>;

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
    .map((m) => compareProductMetric(m.metricKey, m.value))
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

OTHER PRODUCT/CUSTOMER EVIDENCE SUBMITTED (qualitative/narrative context, no benchmark comparison pre-computed):
${formatEvidenceForPrompt(evidenceFields)}

Produce your findings now, following the output schema exactly.`;
}

export const productLens: LensModule = {
  lens: "product",

  async runDraft(input: LensDraftInput): Promise<LensDraftResult> {
    const raw: RawProductLensOutput = await generateValidatedJson(productLensOutputSchema, {
      schemaName: "product-lens",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    });

    const findings: LensFinding[] = raw.findings.map((f, i) => ({
      findingId: `product-${i}`,
      title: f.title,
      rootCause: f.rootCause,
      evidenceCited: f.evidenceCited,
      goalRelevance: f.goalRelevance,
      financialImpact: f.financialImpact,
      confidenceLevel: f.confidenceLevel,
      isMissingDataFinding: f.isMissingDataFinding,
    }));

    return {
      lens: "product",
      findings,
      evidenceSufficiency: raw.evidenceSufficiency,
      notes: raw.notes,
    };
  },
};
