import { generateValidatedJson } from "@/lib/ai-client";
import { computeJurisdictionApplicability, hasNoApplicableRegulations } from "./jurisdiction";
import { dataProtectionOutputSchema, type RawDataProtectionOutput } from "./schemas";
import type {
  DataProtectionCategory,
  DataProtectionCategoryEvidence,
  DataProtectionDraftInput,
  DataProtectionDraftResult,
  DataProtectionFinding,
  DataProtectionRegulation,
} from "./types";

/**
 * Data Protection Compliance — GDPR-first build order (spec §1.8a/§1.8d,
 * confirmed 2026-08-02), now including Saudi PDPL as a real branch
 * (extended 2026-08-03 — PDPL is already actively enforced today, not
 * gated on future Gulf market entry). Jurisdiction applicability (UK GDPR
 * / EU GDPR / Saudi PDPL) is computed deterministically BEFORE any AI
 * call — the model only ever drafts content within regulations code has
 * already determined apply, and is explicitly told which those are; it
 * never decides applicability itself.
 */

const CATEGORY_LABELS: Record<DataProtectionCategory, string> = {
  consent_flow: "Consent-flow review — how consent is captured, recorded, and withdrawn",
  data_subject_rights: "Data-subject-rights readiness — access, correction, deletion, and portability requests",
  retention_policy: "Retention policy review — defined retention periods and deletion practice",
  breach_response: "Breach-response readiness — detection, internal escalation, and regulator/individual notification",
  cross_border_transfer: "Cross-border transfer check — safeguards for personal data leaving the UK/EU (SCCs, adequacy, etc.)",
};

const CATEGORY_EVIDENCE_KEYS: Record<DataProtectionCategory, keyof DataProtectionCategoryEvidence> = {
  consent_flow: "consentFlow",
  data_subject_rights: "dataSubjectRights",
  retention_policy: "retentionPolicy",
  breach_response: "breachResponse",
  cross_border_transfer: "crossBorderTransfer",
};

function applicableRegulationsList(applicability: ReturnType<typeof computeJurisdictionApplicability>): DataProtectionRegulation[] {
  const regs: DataProtectionRegulation[] = [];
  if (applicability.ukGdpr) regs.push("uk_gdpr");
  if (applicability.euGdpr) regs.push("eu_gdpr");
  if (applicability.saudiPdpl) regs.push("saudi_pdpl");
  return regs;
}

/**
 * Same "missing evidence is itself the finding" principle used across
 * Financial, AI & Governance, AI Reliability Audit, and Tender Readiness —
 * guaranteed in code, never left to LLM discretion. One per blank category
 * (not one module-wide finding), since each of the five areas is its own
 * distinct compliance gap.
 */
function buildMissingEvidenceFinding(category: DataProtectionCategory, regulations: DataProtectionRegulation[]): DataProtectionFinding {
  return {
    findingId: `data_protection-no_evidence-${category}`,
    title: `No evidence submitted for ${CATEGORY_LABELS[category].split(" — ")[0]}`,
    diagnosis: `This company is subject to at least one applicable data-protection regulation (${regulations.join(", ")}) but submitted no evidence describing its current ${CATEGORY_LABELS[category].toLowerCase()}.`,
    rootCause: `No evidence has been prepared or submitted yet for this compliance area, so current practice — if any — is unverified.`,
    recommendedAction: `Document current practice for ${CATEGORY_LABELS[category].split(" — ")[0].toLowerCase()} (or confirm none exists yet) so this can be assessed against the applicable regulation's requirements.`,
    severity: "high",
    category,
    applicableRegulations: regulations,
    evidenceCited: [`evidence.${CATEGORY_EVIDENCE_KEYS[category]}`],
    confidenceLevel: "high",
    isMissingDataFinding: true,
  };
}

/**
 * Composes divergence guidance for whichever combination of regulations
 * actually applies — up to three now that Saudi PDPL is a real branch, not
 * a single boolean gate. Each note is only included when the relevant
 * combination is present.
 */
function buildDivergenceNote(applicableRegulations: DataProtectionRegulation[]): string {
  const has = (r: DataProtectionRegulation) => applicableRegulations.includes(r);
  const notes: string[] = [];

  if (has("uk_gdpr") && has("eu_gdpr")) {
    notes.push(
      `UK GDPR and EU GDPR apply simultaneously. These are near-identical in substance but diverge procedurally: "breach_response" (UK GDPR: notify the ICO; EU GDPR: notify the relevant national supervisory authority — a company facing both may need to notify two separate regulators) and "cross_border_transfer" (the UK's own adequacy regulations under UK GDPR vs the EU Commission's adequacy decisions under EU GDPR now diverge post-Brexit — a transfer mechanism valid under one may not automatically be valid under the other).`,
    );
  }

  if (has("saudi_pdpl") && (has("uk_gdpr") || has("eu_gdpr"))) {
    notes.push(
      `Saudi PDPL applies alongside GDPR/UK GDPR. Do not treat PDPL as interchangeable with GDPR: it is enforced by SDAIA, a distinct regulator from the ICO/EU supervisory authorities, and "cross_border_transfer" is a genuinely distinct mechanism — PDPL restricts transfers of personal data outside Saudi Arabia unless a SDAIA-recognized adequacy decision, approved contractual safeguards, or another SDAIA-sanctioned mechanism applies, separate from GDPR's SCC/adequacy-decision framework. Note for "breach_response": both PDPL and GDPR/UK GDPR use a 72-hour notification window to the regulator, so do not describe PDPL's timeframe as "stricter" than GDPR's on this point — the substantive difference is which regulator is notified, not how fast.`,
    );
  }

  return notes.length > 0 ? `\n\n${notes.join("\n\n")}\n\nReflect these distinctions in "applicableRegulations" per finding rather than assuming all applicable regimes are interchangeable.` : "";
}

function buildPrompt(
  companyId: string,
  applicableRegulations: DataProtectionRegulation[],
  categoriesWithEvidence: DataProtectionCategory[],
  categoriesWithoutEvidence: DataProtectionCategory[],
  input: DataProtectionDraftInput,
): string {
  const hasSharedDocument = Boolean(input.existingDocumentationText?.trim());

  // Real document upload (confirmed 2026-08-12) — when a shared document
  // exists, categories with no directly typed evidence are no longer
  // unconditionally off-limits: the LLM may draft a genuine finding for
  // one of them, but ONLY if the shared document itself actually
  // addresses it, never by inference or assumption. This does NOT weaken
  // the deterministic guarantee — index.ts's own post-processing (not
  // this prompt instruction) is what actually decides, after the fact,
  // whether to keep the guaranteed placeholder or the LLM's real finding
  // for each such category. Same "verify what the model actually did,
  // don't just trust the instruction" discipline as everywhere else in
  // this codebase — this rule shapes what the model is invited to try,
  // the code below is what's actually trusted.
  const noEvidenceRule =
    categoriesWithoutEvidence.length === 0
      ? ""
      : hasSharedDocument
        ? `\n5. The following categories had no directly typed evidence: ${categoriesWithoutEvidence.join(", ")}. A shared document was uploaded (see below) — check it specifically for each of these categories. If it genuinely addresses a category with real, specific content, draft one genuine finding for that category (isMissingDataFinding: false, evidenceCited: ["existingDocumentationText"]). If it does NOT address a given category at all, do not draft anything for that category — do not guess or infer coverage that isn't there, and do not write a finding about the absence either (a separate mechanism already handles that).`
        : `\n5. The following categories had NO evidence submitted: ${categoriesWithoutEvidence.join(", ")}. That gap is ALREADY guaranteed as a separate finding for each of those categories elsewhere in the system — do NOT write your own finding about missing/absent evidence for those categories. Only draft findings for the categories listed below as having evidence.`;
  const divergenceNote = buildDivergenceNote(applicableRegulations);
  const sharedDocumentSection = hasSharedDocument
    ? `\n\nSHARED DOCUMENT (uploaded by the client — extracted text, may cover any of the five categories, including ones with no directly typed evidence above):\n${input.existingDocumentationText}`
    : "";
  // Widened to every category when a shared document exists (see rule 5
  // above) — otherwise unchanged, restricted to categories with typed
  // evidence, exactly as before this feature.
  const allowedCategoriesForSchema = hasSharedDocument ? categoriesWithEvidence.concat(categoriesWithoutEvidence) : categoriesWithEvidence;

  return `You are the Data Protection Compliance module of an AI execution audit. You assess data-protection compliance readiness — consent flows, data-subject-rights handling, retention policy, breach-response readiness, and cross-border transfer safeguards — ONLY within the regulations listed below as applicable (GDPR variants and/or Saudi PDPL). This is a general, AI-agnostic data-protection assessment, not an AI-specific governance review (that's a separate module's job) — do not discuss AI risk classification or AI governance maturity here. You do not write prose reports.

HARD RULES — violating any of these makes your output unusable:
1. The applicable regulations below were already determined by code from the company's registration/customer-market data — you do not decide applicability, and you must NEVER produce a finding tagged with a regulation not listed as applicable.
2. Never fabricate a claim not grounded in the submitted evidence. Every finding must cite the specific evidence it came from in "evidenceCited" (e.g. "evidence.consentFlow", or "existingDocumentationText" for the shared document).
3. If evidence for a category is present but too sparse to assess confidently, do not guess — reflect that via confidenceLevel "insufficient" rather than manufacturing a finding.
4. Output strict JSON matching the schema below. No prose outside the JSON.${noEvidenceRule}

FINDING STRUCTURE — four fields must stay distinct, never folded together:
- "diagnosis": the observation itself — what the evidence shows about this category.
- "rootCause": the underlying mechanism — WHY this is happening. Must be genuinely causal, not a restatement of the diagnosis.
- "recommendedAction": the concrete fix — WHAT TO DO about it.
- "severity": "critical" | "high" | "medium" | "low" — business/compliance-risk impact if left unaddressed, independent of confidenceLevel.

APPLICABLE REGULATIONS FOR THIS COMPANY (already determined by code — do not add or omit any): ${applicableRegulations.join(", ")}${divergenceNote}

CATEGORIES WITH EVIDENCE SUBMITTED (draft findings only for these):
${categoriesWithEvidence.map((c) => `- ${c}: ${CATEGORY_LABELS[c]}\n  Evidence: ${input.evidence[CATEGORY_EVIDENCE_KEYS[c]]}`).join("\n")}${sharedDocumentSection}

OUTPUT SCHEMA (JSON object):
{
  "findings": [
    {
      "title": string,
      "diagnosis": string,
      "rootCause": string,
      "recommendedAction": string,
      "severity": "critical" | "high" | "medium" | "low",
      "category": ${allowedCategoriesForSchema.map((c) => `"${c}"`).join(" | ")},
      "applicableRegulations": (${applicableRegulations.map((r) => `"${r}"`).join(" | ")})[],
      "evidenceCited": string[],
      "confidenceLevel": "high" | "medium" | "low" | "insufficient",
      "isMissingDataFinding": boolean
    }
  ],
  "notes": string
}

COMPANY ${companyId}

Produce your findings now, following the output schema exactly — every finding's "category" must be one of the categories with evidence listed above${hasSharedDocument ? ", or one of the no-typed-evidence categories ONLY if the shared document genuinely addresses it, per rule 5" : ""}.`;
}

/**
 * Deterministic backstop for the same "prompt-only instruction isn't
 * reliable" failure mode already hit in AI Reliability Audit (twice) and
 * Tender Readiness — built in proactively here rather than waiting to
 * observe it a fourth time. Any LLM-produced finding whose category has no
 * submitted evidence is redundant with buildMissingEvidenceFinding() for
 * that category and is dropped.
 *
 * Real document upload (confirmed 2026-08-12) — no longer a pure filter.
 * A category that had no typed evidence can now legitimately get a real,
 * evidence-grounded LLM finding if a shared document covers it — dropping
 * that finding just because the category "had no evidence" would be
 * wrong once a shared document exists. Returns which findings survive
 * AND which now-covered categories should have their deterministic
 * placeholder finding removed — the actual coverage decision is made
 * here in code, from what the LLM's response genuinely says
 * (isMissingDataFinding: false = real coverage), never trusted from the
 * prompt instruction alone.
 */
function reconcileBlankCategoryFindings(
  llmFindings: DataProtectionFinding[],
  categoriesWithoutEvidence: DataProtectionCategory[],
  hasSharedDocument: boolean,
): { survivingLlmFindings: DataProtectionFinding[]; coveredByDocument: Set<DataProtectionCategory> } {
  const blank = new Set(categoriesWithoutEvidence);
  const coveredByDocument = new Set<DataProtectionCategory>();

  if (!hasSharedDocument) {
    // Unchanged from the original behavior: no shared document means no
    // blank category can have real coverage, so any LLM finding touching
    // one is necessarily a spurious duplicate of the guaranteed finding.
    return { survivingLlmFindings: llmFindings.filter((f) => !blank.has(f.category)), coveredByDocument };
  }

  const survivingLlmFindings = llmFindings.filter((f) => {
    if (!blank.has(f.category)) return true; // categories with typed evidence: unaffected
    if (f.isMissingDataFinding) return false; // the LLM tried to flag an absence itself — drop, the guaranteed finding already covers it
    coveredByDocument.add(f.category); // a genuine, evidence-grounded finding — real coverage found in the shared document
    return true;
  });

  return { survivingLlmFindings, coveredByDocument };
}

export async function runDataProtectionComplianceAudit(input: DataProtectionDraftInput): Promise<DataProtectionDraftResult> {
  const applicability = computeJurisdictionApplicability(input.company);

  if (hasNoApplicableRegulations(applicability)) {
    return {
      applicability,
      findings: [],
      notes: "None of UK GDPR, EU GDPR, or Saudi PDPL currently apply based on this company's registration and customer markets.",
    };
  }

  const applicableRegulations = applicableRegulationsList(applicability);
  const allCategories = Object.keys(CATEGORY_EVIDENCE_KEYS) as DataProtectionCategory[];
  const categoriesWithEvidence = allCategories.filter((c) => {
    const value = input.evidence[CATEGORY_EVIDENCE_KEYS[c]];
    return value !== null && value.trim().length > 0;
  });
  const categoriesWithoutEvidence = allCategories.filter((c) => !categoriesWithEvidence.includes(c));
  const hasSharedDocument = Boolean(input.existingDocumentationText?.trim());

  // Every blank category still gets its guaranteed placeholder finding up
  // front, same as before this feature — reconcileBlankCategoryFindings()
  // below (not this line) decides afterward, from the LLM's actual
  // response, which of these get removed because real coverage was found
  // in a shared document. Never removed pre-emptively just because a
  // document was uploaded — uploading a document doesn't guarantee it
  // addresses every category.
  const findings: DataProtectionFinding[] = categoriesWithoutEvidence.map((c) => buildMissingEvidenceFinding(c, applicableRegulations));

  if (categoriesWithEvidence.length === 0 && !hasSharedDocument) {
    return { applicability, findings, notes: "No category evidence submitted — only the missing-evidence gaps could be assessed." };
  }

  const raw: RawDataProtectionOutput = await generateValidatedJson(dataProtectionOutputSchema, {
    schemaName: "data-protection-compliance",
    messages: [{ role: "system", content: buildPrompt(input.companyId, applicableRegulations, categoriesWithEvidence, categoriesWithoutEvidence, input) }],
  });

  const llmFindings: DataProtectionFinding[] = raw.findings.map((f, i) => ({
    findingId: `data_protection-${i}`,
    title: f.title,
    diagnosis: f.diagnosis,
    rootCause: f.rootCause,
    recommendedAction: f.recommendedAction,
    severity: f.severity,
    category: f.category,
    applicableRegulations: f.applicableRegulations,
    evidenceCited: f.evidenceCited,
    confidenceLevel: f.confidenceLevel,
    isMissingDataFinding: f.isMissingDataFinding,
  }));

  const { survivingLlmFindings, coveredByDocument } = reconcileBlankCategoryFindings(llmFindings, categoriesWithoutEvidence, hasSharedDocument);

  // Real coverage found via the shared document (confirmed 2026-08-12) —
  // remove that category's guaranteed placeholder now that a genuine,
  // evidence-grounded finding exists for it instead.
  const finalFindings = coveredByDocument.size > 0 ? findings.filter((f) => !coveredByDocument.has(f.category)) : findings;
  finalFindings.push(...survivingLlmFindings);

  return { applicability, findings: finalFindings, notes: raw.notes };
}

export { computeJurisdictionApplicability } from "./jurisdiction";
export type * from "./types";
