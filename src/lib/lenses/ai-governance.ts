import { z } from "zod";
import { generateValidatedJson } from "@/lib/ai-client";
import {
  computeOverallMaturity,
  formatDimensionScoresForPrompt,
  GOVERNANCE_DIMENSIONS,
  scoreDimension,
  type ComputedDimensionScore,
  type GovernanceDimensionKey,
} from "./ai-governance-framework";
import { formatGoalContextForPrompt } from "./goals";
import {
  confidenceLevelSchema,
  evidenceSufficiencySchema,
  financialImpactSchema,
  goalRelevanceSchema,
  severitySchema,
} from "./schemas";
import type { CompanyProfileForLens, EvidenceFieldInput, EvidenceSufficiency, GoalContext, LensFinding } from "./types";

/**
 * AI & Governance is architecturally different from Financial/Execution's
 * pure evidence-in shape — it branches on mode (spec §2.3 step 4) and has
 * its own input/output shape, so it deliberately does NOT implement the
 * shared LensModule interface. Forcing it into that interface would be a
 * worse abstraction than just being honest that this lens is shaped
 * differently. See lenses/index.ts for how it's registered separately.
 *
 * SCOPE (confirmed with founder before building):
 * - This lens does NOT produce the AI Opportunity output. That's a separate
 *   synthesis step run after all five lenses complete, pulling findings
 *   from all of them together (spec §2.3 step 6) — built later as its own
 *   step, never inside this lens.
 * - Mode is decided by whether governance documents were submitted, NOT by
 *   whether the company has live AI in production — those are independent
 *   signals. A company with live AI but no governance docs still gets
 *   questionnaire mode, but that specific combination is elevated to a
 *   guaranteed high-severity finding (see LIVE_AI_NO_DOCS_FINDING below),
 *   the same "missing evidence is itself a finding" principle used
 *   elsewhere — it must never quietly default to a routine path.
 * - Deep EU AI Act conformity/risk classification is the Tender Readiness
 *   module's job (built later, standalone). This lens only assesses
 *   whether the company has ANY governance awareness/process — a maturity
 *   signal, not a formal compliance audit.
 */

export type AiGovernanceMode = "document_review" | "questionnaire";

export interface AiGovernanceDraftInput {
  company: CompanyProfileForLens;
  goal: GoalContext;
  hasLiveAiInProduction: boolean;
  /** Determines mode: true -> document_review, false -> questionnaire. */
  governanceDocsSubmitted: boolean;
  /** Questionnaire mode: client/reviewer self-assessment, 0-3 per dimension. Partial is fine. */
  questionnaireScores?: Partial<Record<GovernanceDimensionKey, number>>;
  /** Document-review mode: submitted governance document content/excerpts. */
  governanceEvidence?: EvidenceFieldInput[];
}

export interface AiGovernanceDraftResult {
  lens: "ai_governance";
  mode: AiGovernanceMode;
  findings: LensFinding[];
  dimensionScores: ComputedDimensionScore[];
  overallMaturity: ReturnType<typeof computeOverallMaturity>;
  evidenceSufficiency: EvidenceSufficiency;
  notes?: string;
}

const SHARED_RULES = `HARD RULES — violating any of these makes your output unusable:
1. Never fabricate a claim not grounded in the submitted evidence (questionnaire scores or governance documents). Every finding must cite the specific dimension key(s) or document excerpt(s) it came from in "evidenceCited".
2. Do NOT produce an "AI Opportunity" recommendation — do not suggest new AI use cases, tools, or initiatives the company should adopt. That is a separate synthesis step run later across all five lenses, not this lens's job. Your job is ONLY to assess existing AI governance risk/maturity.
3. Do NOT perform a formal EU AI Act conformity assessment or definitive legal risk classification — that deep work belongs to the standalone Tender Readiness module. You may reference the AI Act's tiers as context for why a dimension matters, but do not issue a formal classification verdict.
4. Only raise a finding for a dimension that shows a genuine gap (a low score, or evidence too thin to assess) or a specific compliance/risk exposure. Do NOT create findings praising dimensions that scored well — this lens surfaces risk, not a scorecard.
5. Financial impact is always a range with a confidence level and stated assumptions — never a single fake-precise number. Most governance gaps are risk exposure, not a clean cost figure — set financialImpact to null unless you can genuinely ground a band (e.g. cost of remediation, or a stated regulatory exposure if the company's AI use is plausibly high-risk).
6. Weigh findings by relevance to the client's stated goal (see goalRelevance), but do not suppress materially important governance risk just because it's "unrelated" to the stated goal. Per rule 4 this lens only raises risk/gap findings, never a "things are healthy" finding, so "directly_supports" (shared across all lenses) will rarely if ever apply here. "directly_affects" — a real, material, often-quantifiable cost or exposure tied to the goal that is NOT itself the primary/dominant obstruction — is more likely to come up than "directly_supports": e.g. a governance gap with a real, boundable financial exposure (a plausible fine/remediation-cost range) under a cash-flow-efficiency goal, without that gap being what's actually blocking the business from hitting the goal. Do not stretch a real gap into "directly_blocks" or invent a value outside the five listed in the schema below just because none feels like a perfect fit — pick the closest of these five instead.
7. Output strict JSON matching the schema below. No prose outside the JSON.

FINDING STRUCTURE — four fields must stay distinct, never folded together:
- "diagnosis": the observation itself — what was actually found, in full (which dimension, what the evidence/score shows). This is the WHAT.
- "rootCause": the underlying mechanism — WHY this gap exists. Must be genuinely causal, not a restatement of the diagnosis. If you don't have enough evidence to explain why, say so honestly rather than inventing a cause.
- "recommendedAction": the concrete fix — WHAT TO DO about it. Ground it in the actual finding; don't recommend something the evidence doesn't support.
- "severity": "critical" | "high" | "medium" | "low" — how much this matters to the business if left unaddressed. Independent of confidenceLevel (how sure you are) and independent of goalRelevance (how tied to the stated goal it is).`;

const findingSchema = z.object({
  title: z.string(),
  diagnosis: z.string(),
  rootCause: z.string(),
  recommendedAction: z.string(),
  severity: severitySchema,
  evidenceCited: z.array(z.string()),
  goalRelevance: goalRelevanceSchema,
  financialImpact: financialImpactSchema,
  confidenceLevel: confidenceLevelSchema,
  isMissingDataFinding: z.boolean(),
});

function buildCompanyBlock(company: CompanyProfileForLens, goal: GoalContext, hasLiveAiInProduction: boolean): string {
  return `COMPANY PROFILE:
Name: ${company.name}
Industry: ${company.industry ?? "unknown"}
Business model: ${company.businessModel ?? "unknown"}
Registered in: ${company.registrationCountry ?? "unknown"}
Customer markets: ${company.customerMarketCountries.length > 0 ? company.customerMarketCountries.join(", ") : "unknown"}
Employee count: ${company.employeeCount ?? "unknown"}
Stage: ${company.stage ?? "unknown"}
Team structure: ${company.teamStructureSummary ?? "unknown"}
Has live AI in production: ${hasLiveAiInProduction ? "yes" : "no"}

GOAL CONTEXT:
${formatGoalContextForPrompt(goal)}`;
}

/** The combination this lens must never quietly default past — see module docblock. */
function buildLiveAiNoDocsFinding(): LensFinding {
  return {
    findingId: "ai_governance-live_ai_no_docs",
    title: "Live AI in production with no governance documentation",
    diagnosis:
      "The company reports using AI in a live/production capacity but has not submitted any governance documentation (AI use inventory, risk assessment, human-oversight process, or data-handling policy).",
    rootCause:
      "Live AI without documented governance is a structural gap in its own right, independent of how any individual maturity dimension scores — the company adopted or deployed AI faster than it built the oversight to match it.",
    recommendedAction:
      "Produce a minimal AI use inventory and a documented human-oversight process before adding further AI-powered functionality — this is the prerequisite most other governance dimensions build on.",
    severity: "critical",
    evidenceCited: ["has_live_ai_in_production", "governance_docs_submitted"],
    goalRelevance: "directly_blocks",
    financialImpact: null,
    confidenceLevel: "high",
    isMissingDataFinding: true,
  };
}

// ── Questionnaire mode ───────────────────────────────────────────────────

const questionnaireOutputSchema = z.object({
  findings: z.array(findingSchema),
  evidenceSufficiency: evidenceSufficiencySchema,
  notes: z.string().optional(),
});

function buildQuestionnaireSystemPrompt(): string {
  return `You are the AI & Governance lens of an AI execution audit for founder-led B2B SaaS and tech-enabled SMEs (20-200 employees, UK/NL first) — QUESTIONNAIRE MODE (no governance documents were submitted; you're working from a structured self-assessment). You produce a structured set of findings. You do not write prose reports.

${SHARED_RULES}
8. COMPUTED MATURITY SCORES ARE FINAL — DO NOT RE-SCORE. Every dimension's score (0-3) and level description below was supplied by the client/reviewer and looked up against a fixed rubric in code — it is not yours to judge or second-guess. Your job is to narrate the risk implications of each low-scoring or missing dimension, not to re-assess the score itself.

GOVERNANCE DIMENSIONS (reference — the computed scores below are what's final, not this list):
${GOVERNANCE_DIMENSIONS.map((d) => `- ${d.label} [source: ${d.source}]`).join("\n")}

OUTPUT SCHEMA (JSON object):
{
  "findings": [
    {
      "title": string,
      "diagnosis": string,           // the observation itself, in full — see FINDING STRUCTURE
      "rootCause": string,           // the underlying mechanism, not just the symptom — see FINDING STRUCTURE
      "recommendedAction": string,   // the concrete fix — see FINDING STRUCTURE
      "severity": "critical" | "high" | "medium" | "low",
      "evidenceCited": string[],
      "goalRelevance": "directly_blocks" | "directly_affects" | "directly_supports" | "indirectly_affects" | "unrelated",
      "financialImpact": { "impactBandLow": number, "impactBandHigh": number, "currency": string, "confidenceLevel": "high"|"medium"|"low"|"insufficient", "assumptions": string[] } | null,
      "confidenceLevel": "high" | "medium" | "low" | "insufficient",
      "isMissingDataFinding": boolean
    }
  ],
  "evidenceSufficiency": "sufficient" | "partial" | "insufficient",
  "notes": string
}`;
}

async function runQuestionnaireMode(input: AiGovernanceDraftInput): Promise<AiGovernanceDraftResult> {
  const providedScores = input.questionnaireScores ?? {};
  const dimensionScores: ComputedDimensionScore[] = GOVERNANCE_DIMENSIONS.map((d) => {
    const raw = providedScores[d.key];
    return raw === undefined ? null : scoreDimension(d.key, raw);
  }).filter((s) => s !== null);

  const unscoredDimensions = GOVERNANCE_DIMENSIONS.filter((d) => providedScores[d.key] === undefined);
  const overallMaturity = computeOverallMaturity(dimensionScores);

  const userPrompt = `${buildCompanyBlock(input.company, input.goal, input.hasLiveAiInProduction)}

COMPUTED DIMENSION SCORES (already scored and looked up — do not re-score, see rule 8):
${formatDimensionScoresForPrompt(dimensionScores)}

DIMENSIONS WITH NO SCORE SUBMITTED (treat as insufficient evidence, not as an assumed-good score):
${unscoredDimensions.length === 0 ? "(none — all dimensions scored)" : unscoredDimensions.map((d) => `- ${d.label}`).join("\n")}

COMPUTED OVERALL MATURITY: ${overallMaturity.comparisonText}

Produce your findings now, following the output schema exactly.`;

  const raw = await generateValidatedJson(questionnaireOutputSchema, {
    schemaName: "ai-governance-lens-questionnaire",
    messages: [
      { role: "system", content: buildQuestionnaireSystemPrompt() },
      { role: "user", content: userPrompt },
    ],
  });

  const findings: LensFinding[] = raw.findings.map((f, i) => ({
    findingId: `ai_governance-${i}`,
    ...f,
  }));

  if (input.hasLiveAiInProduction) {
    findings.unshift(buildLiveAiNoDocsFinding());
  }

  return {
    lens: "ai_governance",
    mode: "questionnaire",
    findings,
    dimensionScores,
    overallMaturity,
    evidenceSufficiency: raw.evidenceSufficiency,
    notes: raw.notes,
  };
}

// ── Document-review mode ─────────────────────────────────────────────────

const dimensionScoreOutputSchema = z.object({
  key: z.enum(GOVERNANCE_DIMENSIONS.map((d) => d.key) as [GovernanceDimensionKey, ...GovernanceDimensionKey[]]),
  score: z.number().min(0).max(3),
});

const documentReviewOutputSchema = z.object({
  findings: z.array(findingSchema),
  dimensionScores: z.array(dimensionScoreOutputSchema),
  evidenceSufficiency: evidenceSufficiencySchema,
  notes: z.string().optional(),
});

function buildDocumentReviewSystemPrompt(): string {
  return `You are the AI & Governance lens of an AI execution audit for founder-led B2B SaaS and tech-enabled SMEs (20-200 employees, UK/NL first) — DOCUMENT-REVIEW MODE (the client submitted governance documentation for you to assess). You produce a structured set of findings. You do not write prose reports.

${SHARED_RULES}
8. For EACH of the 7 governance dimensions listed below, assign a score from 0-3 based ONLY on what the submitted documents actually show — pick the integer score whose rubric description best matches the evidence. This is a classification task (which bucket does the evidence fall into), not free-form scoring — do not invent your own scale or wording. If the documents say nothing about a dimension, score it 0 and mark it as insufficient evidence in your findings, do not assume a mid-range score out of politeness.

GOVERNANCE DIMENSIONS AND THEIR 0-3 RUBRIC (pick the integer whose description best matches the evidence — do not paraphrase the rubric, just select the score):
${GOVERNANCE_DIMENSIONS.map(
  (d) => `- ${d.key} [source: ${d.source}]:\n  0 = ${d.levels[0]}\n  1 = ${d.levels[1]}\n  2 = ${d.levels[2]}\n  3 = ${d.levels[3]}`,
).join("\n")}

OUTPUT SCHEMA (JSON object):
{
  "findings": [
    {
      "title": string,
      "diagnosis": string,           // the observation itself, in full — see FINDING STRUCTURE
      "rootCause": string,           // the underlying mechanism, not just the symptom — see FINDING STRUCTURE
      "recommendedAction": string,   // the concrete fix — see FINDING STRUCTURE
      "severity": "critical" | "high" | "medium" | "low",
      "evidenceCited": string[],
      "goalRelevance": "directly_blocks" | "directly_affects" | "directly_supports" | "indirectly_affects" | "unrelated",
      "financialImpact": { "impactBandLow": number, "impactBandHigh": number, "currency": string, "confidenceLevel": "high"|"medium"|"low"|"insufficient", "assumptions": string[] } | null,
      "confidenceLevel": "high" | "medium" | "low" | "insufficient",
      "isMissingDataFinding": boolean
    }
  ],
  "dimensionScores": [ { "key": string, "score": number } ],
  "evidenceSufficiency": "sufficient" | "partial" | "insufficient",
  "notes": string
}`;
}

function formatGovernanceEvidenceForPrompt(fields: EvidenceFieldInput[]): string {
  if (fields.length === 0) {
    return "(no governance documents submitted — this shouldn't happen in document-review mode; treat all dimensions as insufficient evidence)";
  }
  return fields
    .map((f) => {
      const value = f.isBlank || f.fieldValue === null ? "(blank)" : f.fieldValue;
      return `- ${f.fieldName}: ${value} [source: ${f.source}]`;
    })
    .join("\n");
}

async function runDocumentReviewMode(input: AiGovernanceDraftInput): Promise<AiGovernanceDraftResult> {
  const userPrompt = `${buildCompanyBlock(input.company, input.goal, input.hasLiveAiInProduction)}

SUBMITTED GOVERNANCE DOCUMENTS/EVIDENCE:
${formatGovernanceEvidenceForPrompt(input.governanceEvidence ?? [])}

Produce your findings AND your per-dimension scores now, following the output schema exactly.`;

  const raw = await generateValidatedJson(documentReviewOutputSchema, {
    schemaName: "ai-governance-lens-document-review",
    messages: [
      { role: "system", content: buildDocumentReviewSystemPrompt() },
      { role: "user", content: userPrompt },
    ],
  });

  // The LLM only picks a 0-3 integer per dimension; the canonical label/level
  // text/source is always looked up here in code, never generated by the model.
  const dimensionScores: ComputedDimensionScore[] = raw.dimensionScores
    .map((d) => scoreDimension(d.key, d.score))
    .filter((s) => s !== null);
  const overallMaturity = computeOverallMaturity(dimensionScores);

  const findings: LensFinding[] = raw.findings.map((f, i) => ({
    findingId: `ai_governance-${i}`,
    ...f,
  }));

  if (input.hasLiveAiInProduction && (input.governanceEvidence ?? []).length === 0) {
    findings.unshift(buildLiveAiNoDocsFinding());
  }

  return {
    lens: "ai_governance",
    mode: "document_review",
    findings,
    dimensionScores,
    overallMaturity,
    evidenceSufficiency: raw.evidenceSufficiency,
    notes: raw.notes,
  };
}

// ── Entry point ───────────────────────────────────────────────────────────

export const aiGovernanceLens = {
  lens: "ai_governance" as const,

  async runDraft(input: AiGovernanceDraftInput): Promise<AiGovernanceDraftResult> {
    return input.governanceDocsSubmitted ? runDocumentReviewMode(input) : runQuestionnaireMode(input);
  },
};
