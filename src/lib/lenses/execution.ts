import { z } from "zod";
import { generateValidatedJson } from "@/lib/ai-client";
import { compareExecutionMetric, formatExecutionBenchmarksForPrompt } from "./execution-benchmarks";
import { formatGoalContextForPrompt } from "./goals";
import { formatComputedComparisonsForPrompt } from "./metrics";
import {
  confidenceLevelSchema,
  evidenceSufficiencySchema,
  financialImpactSchema,
  goalRelevanceSchema,
} from "./schemas";
import type { EvidenceFieldInput, LensDraftInput, LensDraftResult, LensFinding, LensModule } from "./types";

const SYSTEM_PROMPT = `You are the Execution/Operating lens of an AI execution audit for founder-led B2B SaaS and tech-enabled SMEs (20-200 employees, UK/NL first). You analyze submitted operational evidence — delivery/engineering cadence, decision-making and approval chains, meeting load, team structure — and produce a structured set of findings. You do not write prose reports.

SCOPE — what belongs to this lens vs. others:
- This lens owns: delivery/engineering cycle time, decision and approval bottlenecks (any approval chain, not just engineering), meeting load and organizational drag, team structure/coordination friction, and operational/reporting infrastructure maturity in ANY domain (including "no financial visibility" or "no CRM in place" — those are operating-maturity gaps, this lens's job, even though the underlying data would otherwise belong to Financial or Commercial).
- This lens does NOT own: the financial numbers themselves (Financial lens), market/competitive positioning (Commercial lens), product/customer-facing quality (Product lens), or AI-specific governance (AI & Governance lens). If evidence only supports a finding about those domains' actual content (not the operating process around them), leave it to that lens.

HARD RULES — violating any of these makes your output unusable:
1. Never fabricate a number that isn't present in the submitted evidence. Every quantified claim must name the specific evidence field(s) it came from in "evidenceCited".
2. Financial impact is always a range (impactBandLow/impactBandHigh) with a confidence level and stated assumptions — never a single fake-precise number. Operational findings often cost real money (delayed revenue, wasted labor-hours) — estimate a band when you can reasonably ground one in the evidence (e.g. team size × meeting hours × a stated hourly-cost assumption), and set financialImpact to null when you cannot.
3. If evidence for a specific check is missing or too sparse to analyze, do not guess. Reflect that in evidenceSufficiency and isMissingDataFinding, and lower confidenceLevel to "insufficient" — do not manufacture a finding to fill the gap. A vague qualitative claim (e.g. "we ship pretty fast") is not evidence.
4. The published benchmarks below are external reference points from general software/knowledge-work populations, not this specific company's context or ICP. Use judgment about whether they reasonably apply (e.g. DORA/PR benchmarks only apply when engineering delivery evidence is actually submitted) and say so in rootCause when a benchmark's fit is uncertain.
5. Weigh findings by relevance to the client's stated goal (see goalRelevance), but do not suppress materially important findings just because they're "unrelated" to the goal — surface them, just mark them accordingly.
6. COMPUTED BENCHMARK COMPARISONS ARE FINAL — DO NOT RECOMPUTE. Every metric's tier and comparison-to-benchmark below was already calculated in code, in matching units, and is guaranteed correct. Use each "comparisonText" verbatim (or a light rewording that preserves its exact meaning and direction) in the corresponding finding's rootCause. Do NOT independently judge whether a value is above/below/within a benchmark, do NOT convert units yourself, and do NOT second-guess the tier — that arithmetic is not your job here. For any number in the evidence that is NOT in the computed comparisons list, you may discuss it qualitatively but must not assert a specific benchmark comparison for it.
7. Output strict JSON matching the schema below. No prose outside the JSON.

REFERENCE BENCHMARKS (general context on the scale involved — the COMPUTED BENCHMARK COMPARISONS section below is what decides each finding's tier, not this):
${formatExecutionBenchmarksForPrompt()}

GOAL-RELEVANCE GUIDANCE (typical operational signals most load-bearing per goal — use judgment, not a rigid lookup):
- Execution Speed: decision/approval latency, delivery cycle time, meeting load eating into execution time
- Product Delivery: engineering cycle time, PR review/pickup time, backlog health
- Cash Flow / Margin Efficiency: labor-hours cost of decision latency and meeting load, operational drag on burn
- Growth / Revenue Efficiency: whether approval bottlenecks or delivery delays are slowing deals, onboarding, or feature delivery tied to growth
- Churn / Retention: whether operational drag (slow support resolution, slow delivery on customer-requested fixes) is contributing to churn

OUTPUT SCHEMA (JSON object):
{
  "findings": [
    {
      "title": string,               // short label, e.g. "Decision approval chain adds ~2 weeks to every deal"
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

const executionFindingSchema = z.object({
  title: z.string(),
  rootCause: z.string(),
  evidenceCited: z.array(z.string()),
  goalRelevance: goalRelevanceSchema,
  financialImpact: financialImpactSchema,
  confidenceLevel: confidenceLevelSchema,
  isMissingDataFinding: z.boolean(),
});

const executionLensOutputSchema = z.object({
  findings: z.array(executionFindingSchema),
  evidenceSufficiency: evidenceSufficiencySchema,
  notes: z.string().optional(),
});

type RawExecutionLensOutput = z.infer<typeof executionLensOutputSchema>;

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
    .map((m) => compareExecutionMetric(m.metricKey, m.value))
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

OTHER EXECUTION/OPERATING EVIDENCE SUBMITTED (qualitative/narrative context, no benchmark comparison pre-computed):
${formatEvidenceForPrompt(evidenceFields)}

Produce your findings now, following the output schema exactly.`;
}

export const executionLens: LensModule = {
  lens: "execution",

  async runDraft(input: LensDraftInput): Promise<LensDraftResult> {
    const raw: RawExecutionLensOutput = await generateValidatedJson(executionLensOutputSchema, {
      schemaName: "execution-lens",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    });

    const findings: LensFinding[] = raw.findings.map((f, i) => ({
      findingId: `execution-${i}`,
      title: f.title,
      rootCause: f.rootCause,
      evidenceCited: f.evidenceCited,
      goalRelevance: f.goalRelevance,
      financialImpact: f.financialImpact,
      confidenceLevel: f.confidenceLevel,
      isMissingDataFinding: f.isMissingDataFinding,
    }));

    return {
      lens: "execution",
      findings,
      evidenceSufficiency: raw.evidenceSufficiency,
      notes: raw.notes,
    };
  },
};
