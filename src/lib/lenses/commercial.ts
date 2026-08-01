import { z } from "zod";
import { generateValidatedJson } from "@/lib/ai-client";
import type { IndependentResearchFinding } from "./commercial-research";
import { formatGoalContextForPrompt } from "./goals";
import {
  confidenceLevelSchema,
  evidenceSufficiencySchema,
  financialImpactSchema,
  findingOriginSchema,
  goalRelevanceSchema,
} from "./schemas";
import type { CompanyProfileForLens, EvidenceSufficiency, FindingOrigin, GoalContext, LensFinding } from "./types";

/**
 * Commercial/Market is architecturally different from Financial/Execution's
 * pure evidence-in shape — it's a hybrid of client self-report plus
 * independently-researched evidence (confirmed 2026-07-31), so it
 * deliberately does NOT implement the shared LensModule interface, same
 * reasoning as AI & Governance. See lenses/index.ts for registration.
 *
 * HYBRID DESIGN:
 * 1. Client self-reports first — named competitors, market change notes,
 *    pricing pressure, lost deals they're aware of.
 * 2. The system separately runs its own research (see ./commercial-research):
 *    targeted searches on the client's named competitors (bounded) + a
 *    broader independent scan.
 * 3. Findings are shown back to the client with clear source tagging
 *    (`origin`: client_reported vs ai_independent). For ai_independent
 *    findings, the client marks confidence (accurate / not_confident). If
 *    not_confident: dropped from client view, still surfaced to the
 *    reviewer as disputed, with the reviewer's resolution logged
 *    (`is_disputed` / `dispute_resolution_notes` — see supabase/migrations,
 *    not set by this lens; those are set later by the client/reviewer
 *    interaction this lens's output feeds into).
 *
 * ORIGIN TAGGING IS VALIDATED DETERMINISTICALLY, NOT LEFT TO THE LLM (fixed
 * 2026-07-31, same reasoning as the numeric-comparison fix in metrics.ts).
 * Live testing found findings that cited both self-report AND independent-
 * research evidence under a single origin tag — undermining the client-
 * confidence-marking/dispute mechanism this tagging exists for. A prompt-
 * only fix (rule 2a below) measurably improved but did not eliminate it —
 * same "prompt engineering has a ceiling" lesson as the benchmark-direction
 * bug. The real fix: evidence is cited using structured, parseable keys
 * (`self_report.*` / `independent_research.N`, see formatSelfReportForPrompt
 * / formatIndependentResearchForPrompt below) instead of freeform strings,
 * so `classifyAndSplitFindings` can deterministically check after the LLM
 * responds whether a finding's citations actually match its declared origin
 * — and if they span both categories, split it into two correctly-tagged
 * findings rather than trusting the model's own tag.
 */

export interface CommercialSelfReport {
  namedCompetitors: string[];
  marketChangeNotes: string | null;
  pricingPressureNotes: string | null;
  lostDealsNotes: string | null;
}

export interface CommercialDraftInput {
  company: CompanyProfileForLens;
  goal: GoalContext;
  selfReport: CommercialSelfReport;
  /** Already-gathered — see ./commercial-research. Empty until a search provider exists. */
  independentResearch: IndependentResearchFinding[];
}

export interface CommercialDraftResult {
  lens: "commercial";
  findings: LensFinding[];
  evidenceSufficiency: EvidenceSufficiency;
  notes?: string;
}

const SELF_REPORT_KEY_PREFIX = "self_report.";
const INDEPENDENT_RESEARCH_KEY_PATTERN = /^independent_research\.\d+$/;

const SYSTEM_PROMPT = `You are the Commercial/Market lens of an AI execution audit for founder-led B2B SaaS and tech-enabled SMEs (20-200 employees, UK/NL first). You synthesize two kinds of already-gathered evidence — the client's own self-report, and independent research the system already ran — into a structured set of findings. You do not perform research yourself, and you do not write prose reports.

SCOPE — what belongs to this lens vs. others:
- This lens owns: competitive positioning, market dynamics, pricing relative to competitors, deal losses tied to market/competitive factors, market changes affecting the business.
- This lens does NOT own: the company's own financial numbers (Financial lens), internal process/delivery bottlenecks (Execution lens), product/customer-experience quality (Product lens), or AI governance (AI & Governance lens). A lost deal caused by an internal delivery delay is Execution's finding, not this lens's, even if it shows up in the client's "lost deals" note — only claim it here if the loss is genuinely about competitive/market positioning (price, features, brand, market shift), not internal execution.

HARD RULES — violating any of these makes your output unusable:
1. Never fabricate a claim not grounded in the submitted evidence. Every finding must cite the specific evidence it came from in "evidenceCited", using the EXACT bracketed keys shown in the evidence sections below (e.g. "self_report.pricing_pressure_notes", "independent_research.0") — not freeform descriptions. This is validated deterministically after you respond; getting the keys exactly right avoids your finding being auto-split.
2. SOURCE TAGGING IS THE CORE TRUST MECHANISM OF THIS LENS — get it right. Set "origin" to "client_reported" ONLY when a finding is grounded in "self_report.*" keys. Set "origin" to "ai_independent" ONLY when grounded in "independent_research.N" keys. NEVER mark something "ai_independent" based on your own general knowledge of the market or these competitors — if it isn't in the independent-research evidence you were given, it doesn't exist for this purpose. If independentResearch is empty, produce zero ai_independent findings — do not invent research that wasn't run.
2a. A finding is grounded in EITHER "self_report.*" keys OR "independent_research.N" keys — never both. If the client raised something AND independent research corroborates it, that is TWO findings: one citing only self_report.* keys (origin: client_reported), and a separate one citing only independent_research.N keys (origin: ai_independent). Merging them under one origin breaks the client's ability to independently confirm or dispute the ai_independent portion — the entire reason this tagging exists.
3. Financial impact is always a range with a confidence level and stated assumptions — never a single fake-precise number. Set financialImpact to null unless you can genuinely ground a band (e.g. from a stated lost-deal value or pricing gap).
4. If evidence is missing or too sparse to analyze, do not guess. Reflect that in evidenceSufficiency and isMissingDataFinding, and lower confidenceLevel to "insufficient" — do not manufacture a finding to fill the gap. A vague qualitative claim is not evidence.
5. Weigh findings by relevance to the client's stated goal (see goalRelevance), but do not suppress materially important findings just because they're "unrelated" to the goal — surface them, just mark them accordingly.
6. Do NOT create a finding about independent research being unavailable or insufficient (e.g. "no independent research was run," "insufficient market research"). That's a fact about our own evidence-sufficiency state, already captured in the top-level "evidenceSufficiency" field — it is not a diagnostic finding about the client's business, and it has no valid "origin" (it isn't grounded in self-report OR independent research). If independentResearch is empty, simply produce zero ai_independent findings and reflect that in evidenceSufficiency — do not manufacture a finding to comment on it.
7. Output strict JSON matching the schema below. No prose outside the JSON.

GOAL-RELEVANCE GUIDANCE (typical commercial signals most load-bearing per goal — use judgment, not a rigid lookup):
- Growth / Revenue Efficiency: competitive win/loss patterns, pricing pressure, market shifts affecting demand
- Churn / Retention: competitor offerings pulling customers away, market changes affecting retention
- Cash Flow / Margin Efficiency: pricing pressure forcing discounting, margin-eroding competitive dynamics
- Execution Speed / Product Delivery: competitive features/market shifts that raise urgency, but only the market-side signal — not the internal delivery response, which is Execution's or Product's territory

OUTPUT SCHEMA (JSON object):
{
  "findings": [
    {
      "title": string,
      "rootCause": string,
      "evidenceCited": string[],       // exact keys only, e.g. ["self_report.pricing_pressure_notes"] or ["independent_research.0", "independent_research.2"]
      "origin": "client_reported" | "ai_independent",
      "goalRelevance": "directly_blocks" | "indirectly_affects" | "unrelated",
      "financialImpact": { "impactBandLow": number, "impactBandHigh": number, "currency": string, "confidenceLevel": "high"|"medium"|"low"|"insufficient", "assumptions": string[] } | null,
      "confidenceLevel": "high" | "medium" | "low" | "insufficient",
      "isMissingDataFinding": boolean
    }
  ],
  "evidenceSufficiency": "sufficient" | "partial" | "insufficient",
  "notes": string
}`;

const commercialFindingSchema = z.object({
  title: z.string(),
  rootCause: z.string(),
  evidenceCited: z.array(z.string()),
  origin: findingOriginSchema,
  goalRelevance: goalRelevanceSchema,
  financialImpact: financialImpactSchema,
  confidenceLevel: confidenceLevelSchema,
  isMissingDataFinding: z.boolean(),
});

const commercialLensOutputSchema = z.object({
  findings: z.array(commercialFindingSchema),
  evidenceSufficiency: evidenceSufficiencySchema,
  notes: z.string().optional(),
});

type RawCommercialLensOutput = z.infer<typeof commercialLensOutputSchema>;
type RawCommercialFinding = z.infer<typeof commercialFindingSchema>;

function formatSelfReportForPrompt(selfReport: CommercialSelfReport): string {
  return [
    `[self_report.named_competitors] Named competitors: ${selfReport.namedCompetitors.length > 0 ? selfReport.namedCompetitors.join(", ") : "(none named)"}`,
    `[self_report.market_change_notes] Market change notes: ${selfReport.marketChangeNotes ?? "(none)"}`,
    `[self_report.pricing_pressure_notes] Pricing pressure notes: ${selfReport.pricingPressureNotes ?? "(none)"}`,
    `[self_report.lost_deals_notes] Lost deals notes: ${selfReport.lostDealsNotes ?? "(none)"}`,
  ].join("\n");
}

function formatIndependentResearchForPrompt(findings: IndependentResearchFinding[]): string {
  if (findings.length === 0) {
    return "(none — no independent research was run for this audit; produce zero ai_independent findings, see rule 2)";
  }
  return findings
    .map(
      (f, i) =>
        `[independent_research.${i}] ${f.targetedCompetitor ? `targeted: ${f.targetedCompetitor}` : "broader scan"} — ${f.topic}: ${f.summary} (sources: ${f.sourceUrls.join(", ")})`,
    )
    .join("\n");
}

function buildUserPrompt(input: CommercialDraftInput): string {
  const { company, goal, selfReport, independentResearch } = input;

  return `COMPANY PROFILE:
Name: ${company.name}
Industry: ${company.industry ?? "unknown"}
Business model: ${company.businessModel ?? "unknown"}
Registered in: ${company.registrationCountry ?? "unknown"}
Customer markets: ${company.customerMarketCountries.length > 0 ? company.customerMarketCountries.join(", ") : "unknown"}
Employee count: ${company.employeeCount ?? "unknown"}
Stage: ${company.stage ?? "unknown"}
Customer type: ${company.customerType ?? "unknown"}

GOAL CONTEXT:
${formatGoalContextForPrompt(goal)}

CLIENT SELF-REPORT (cite using the exact bracketed key):
${formatSelfReportForPrompt(selfReport)}

INDEPENDENT RESEARCH (already gathered by the system — cite using the exact bracketed key; see rule 2, do not add anything beyond this):
${formatIndependentResearchForPrompt(independentResearch)}

Produce your findings now, following the output schema exactly.`;
}

/**
 * Deterministic origin validation/split — the actual fix, not the prompt
 * rules above (those are a first line of defense, not the guarantee). Every
 * finding's evidenceCited is classified by key prefix; a finding citing
 * both self_report.* and independent_research.N keys is split into two
 * separately-tagged findings rather than trusting the LLM's declared
 * "origin". A finding citing only one category gets its origin corrected
 * to match, regardless of what the LLM declared. Findings with no
 * recognized keys (the model didn't follow the citation format) are passed
 * through unvalidated — there's nothing to check them against.
 */
export function classifyAndSplitFindings(findings: RawCommercialFinding[]): (RawCommercialFinding & { origin: FindingOrigin })[] {
  const result: (RawCommercialFinding & { origin: FindingOrigin })[] = [];

  for (const finding of findings) {
    const selfReportCites = finding.evidenceCited.filter((c) => c.startsWith(SELF_REPORT_KEY_PREFIX));
    const independentCites = finding.evidenceCited.filter((c) => INDEPENDENT_RESEARCH_KEY_PATTERN.test(c));
    const unrecognizedCites = finding.evidenceCited.filter(
      (c) => !c.startsWith(SELF_REPORT_KEY_PREFIX) && !INDEPENDENT_RESEARCH_KEY_PATTERN.test(c),
    );

    const hasSelfReport = selfReportCites.length > 0;
    const hasIndependent = independentCites.length > 0;

    if (hasSelfReport && hasIndependent) {
      // Mixed — split into two correctly-tagged findings rather than trust the declared origin.
      result.push({
        ...finding,
        title: `${finding.title} — as reported by client`,
        origin: "client_reported",
        evidenceCited: [...selfReportCites, ...unrecognizedCites],
      });
      result.push({
        ...finding,
        title: `${finding.title} — per independent research`,
        origin: "ai_independent",
        evidenceCited: independentCites,
      });
    } else if (hasIndependent) {
      result.push({ ...finding, origin: "ai_independent" });
    } else if (hasSelfReport) {
      result.push({ ...finding, origin: "client_reported" });
    } else {
      // No recognized keys — nothing to validate against; pass through as declared.
      result.push({ ...finding, origin: finding.origin });
    }
  }

  return result;
}

export const commercialLens = {
  lens: "commercial" as const,

  async runDraft(input: CommercialDraftInput): Promise<CommercialDraftResult> {
    const raw: RawCommercialLensOutput = await generateValidatedJson(commercialLensOutputSchema, {
      schemaName: "commercial-lens",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
    });

    const validatedFindings = classifyAndSplitFindings(raw.findings);

    const findings: LensFinding[] = validatedFindings.map((f, i) => ({
      findingId: `commercial-${i}`,
      title: f.title,
      rootCause: f.rootCause,
      evidenceCited: f.evidenceCited,
      goalRelevance: f.goalRelevance,
      financialImpact: f.financialImpact,
      confidenceLevel: f.confidenceLevel,
      isMissingDataFinding: f.isMissingDataFinding,
      origin: f.origin,
    }));

    return {
      lens: "commercial",
      findings,
      evidenceSufficiency: raw.evidenceSufficiency,
      notes: raw.notes,
    };
  },
};
