import { generateValidatedJson } from "@/lib/ai-client";
import { computeJurisdictionApplicability } from "./jurisdiction";
import { tenderReadinessOutputSchema, type RawTenderReadinessOutput } from "./schemas";
import type { TenderReadinessDraftInput, TenderReadinessDraftResult, TenderReadinessFinding, TenderReadinessSection } from "./types";

/**
 * Tender Readiness — AI-specific risk-classification content across EU AI
 * Act, UAE DIFC Regulation 10, and Saudi AI governance (spec §1.8b,
 * confirmed 2026-08-02). Jurisdiction applicability is computed
 * deterministically BEFORE any AI call — the model only ever drafts
 * content within sections code has already determined apply, and is
 * explicitly told which those are; it never decides applicability itself.
 */

export const SECTION_LABELS: Record<TenderReadinessSection, string> = {
  eu_ai_act: "EU AI Act (4-tier risk classification: unacceptable/high-risk/limited/minimal)",
  uae_difc_reg10: "UAE DIFC Regulation 10 (AI-specific, DIFC free zone)",
  saudi_ai_governance: "Saudi AI governance — SDAIA's 7 AI Ethics Principles + draft Responsible AI Policy",
  uae_ai_charter_reference: "UAE AI Charter (non-binding, principles-based reference only — never a compliance obligation)",
};

/**
 * Same "missing evidence is itself the finding" principle as Financial, AI
 * & Governance, and AI Reliability Audit — guaranteed in code, never left
 * to LLM discretion. Only fires when a substantive (binding-obligation)
 * section applies — the non-binding AI Charter reference alone doesn't
 * warrant a "no documentation" finding, since it has no documentation
 * requirement to be missing in the first place.
 */
function buildNoDocumentationFinding(applicableSubstantiveSections: TenderReadinessSection[]): TenderReadinessFinding {
  const sectionNames = applicableSubstantiveSections.map((s) => SECTION_LABELS[s]).join("; ");
  return {
    findingId: "tender_readiness-no_documentation",
    title: "No compliance documentation submitted for applicable jurisdictions",
    diagnosis: `This company is subject to at least one AI-specific regulatory regime (${sectionNames}) but has submitted no existing risk assessment, classification, or procurement-readiness documentation.`,
    rootCause: "No compliance documentation has been prepared yet for the jurisdictions that actually apply to this company's AI use and customer/registration footprint.",
    recommendedAction: "Prepare a baseline AI use-case inventory and risk classification for each applicable jurisdiction before responding to procurement requests that ask for it.",
    severity: "high",
    section: applicableSubstantiveSections[0],
    evidenceCited: ["existing_documentation"],
    confidenceLevel: "high",
    isMissingDataFinding: true,
  };
}

/**
 * EU AI Act Article 4 (AI literacy) — confirmed 2026-08-27, Onboarding
 * Architecture & Path Routing brief, Part 8d. Same "guaranteed in code,
 * never left to LLM discretion" pattern as buildNoDocumentationFinding()
 * — a deterministic, structural check, not something an LLM should be
 * trusted to remember to raise. Only fires when the EU AI Act itself
 * applies (Article 4 is part of that Act) and the client has explicitly
 * answered "no" — a null/unanswered response never triggers this, since
 * that's a genuinely different, honest "not asked" state.
 */
function buildArticle4LiteracyFinding(): TenderReadinessFinding {
  return {
    findingId: "tender_readiness-article_4_literacy",
    title: "No structured AI literacy training for staff using AI tools",
    diagnosis:
      "This company has not provided structured AI literacy training to staff who use AI tools in their work, and the EU AI Act applies to this company's operations.",
    rootCause:
      "EU AI Act Article 4 (the AI literacy obligation) has been enforceable since February 2025 and applies to any organisation whose staff use AI tools at work — not only organisations building or deploying AI products — and no formal training program has been put in place to meet it.",
    recommendedAction:
      "Put a structured AI literacy training program in place for staff who use AI tools, covering what the tools can and can't do, their limitations, and the risks of relying on their output — and keep a real record that training was delivered.",
    severity: "medium",
    section: "eu_ai_act",
    evidenceCited: ["ai_literacy_training_provided"],
    confidenceLevel: "high",
    isMissingDataFinding: false,
  };
}

function buildPrompt(companyId: string, applicableSections: TenderReadinessSection[], input: TenderReadinessDraftInput, hasDocs: boolean): string {
  const noDocsRule = hasDocs
    ? ""
    : `\n5. No existing documentation was submitted. That gap is ALREADY guaranteed as a separate finding elsewhere in the system — do NOT write your own finding about missing/absent documentation, missing risk assessments, or "no compliance material submitted." Only write findings that classify or discuss the AI use-case inventory content itself.`;
  // Article 4 dedup rule (Part 8d) — the prompt-level half of the same
  // "prompt-only instruction isn't fully reliable" defense already used for
  // missing-documentation. A dedicated deterministic filter
  // (dropDuplicateArticle4Findings, below) closes the gap this rule alone
  // can't guarantee — confirmed 2026-08-28, same two-layer discipline as
  // every other guaranteed-finding rule in this build.
  const article4Rule =
    input.aiLiteracyTrainingProvided === false && applicableSections.includes("eu_ai_act")
      ? `\n6. This company has already been flagged, in a separate GUARANTEED finding, for not providing AI literacy training under EU AI Act Article 4 — do NOT write your own finding about AI literacy, staff training on AI tools, or Article 4 compliance.`
      : "";
  return `You are the Tender Readiness module of an AI execution audit. You draft AI-specific regulatory risk-classification content, missing-documentation gaps, and procurement-answer material — ONLY within the jurisdictions listed below as applicable. You do not write prose reports.

HARD RULES — violating any of these makes your output unusable:
1. The applicable sections below were already determined by code from the company's registration/customer-market data — you do not decide applicability, and you must NEVER produce a finding for a section not listed as applicable.
2. Never fabricate a claim not grounded in the submitted evidence (the AI use-case inventory or existing documentation). Every finding must cite the specific evidence it came from in "evidenceCited".
3. If evidence is missing or too sparse to classify within an applicable section, do not guess — reflect that via isMissingDataFinding and confidenceLevel "insufficient" rather than manufacturing a finding.
4. Output strict JSON matching the schema below. No prose outside the JSON.${noDocsRule}${article4Rule}

FINDING STRUCTURE — four fields must stay distinct, never folded together:
- "diagnosis": the observation itself — what the evidence shows, including the risk tier/classification where applicable. This is the WHAT.
- "rootCause": the underlying mechanism — WHY this is happening. Must be genuinely causal, not a restatement of the diagnosis.
- "recommendedAction": the concrete fix — WHAT TO DO about it, framed as something usable in a real procurement response.
- "severity": "critical" | "high" | "medium" | "low" — business/procurement impact if left unaddressed, independent of confidenceLevel.

APPLICABLE SECTIONS FOR THIS COMPANY (already determined by code — do not add or omit any):
${applicableSections.map((s) => `- ${s}: ${SECTION_LABELS[s]}`).join("\n")}

OUTPUT SCHEMA (JSON object):
{
  "findings": [
    {
      "title": string,
      "diagnosis": string,
      "rootCause": string,
      "recommendedAction": string,
      "severity": "critical" | "high" | "medium" | "low",
      "section": ${applicableSections.map((s) => `"${s}"`).join(" | ")},
      "evidenceCited": string[],
      "confidenceLevel": "high" | "medium" | "low" | "insufficient",
      "isMissingDataFinding": boolean
    }
  ],
  "notes": string
}

COMPANY ${companyId}
AI use-case inventory: ${input.aiUseCaseInventory}
Existing documentation: ${input.existingDocumentation ?? "(none submitted)"}

Produce your findings now, following the output schema exactly — every finding's "section" must be one of the applicable sections listed above.`;
}

/**
 * Deterministic backstop for the same "prompt-only instruction isn't
 * reliable" failure mode already hit twice in AI Reliability Audit
 * (trace-logs duplication, spurious data-leakage finding). Live testing
 * here found the LLM re-raising "no documentation submitted" as its own
 * separately-worded finding ("Missing Documentation for EU AI Act
 * Compliance") despite the buildNoDocumentationFinding() guarantee already
 * covering it — the prompt rule alone is reinforcement, not a substitute
 * for this filter.
 */
function dropDuplicateMissingDocumentationFindings(findings: TenderReadinessFinding[], hasDocs: boolean): TenderReadinessFinding[] {
  if (hasDocs) return findings;
  const pattern = /missing.{0,20}document|document.{0,20}missing|no.{0,20}document|absent.{0,20}document|lack.{0,20}document/i;
  return findings.filter((f) => {
    if (f.findingId === "tender_readiness-no_documentation") return true;
    const haystack = `${f.title} ${f.diagnosis}`;
    return !pattern.test(haystack);
  });
}

/**
 * Deterministic backstop for Article 4 (AI literacy) duplication —
 * confirmed 2026-08-28, closing the gap disclosed at build time (Part 8d):
 * the prompt rule alone ("do NOT write your own finding about AI literacy
 * / staff training on AI tools / Article 4") is reinforcement, not a
 * guarantee, same class of failure already hit and fixed this way for
 * missing-documentation and (in AI Reliability Audit) trace-logs/
 * data-leakage. Only ever filters when the guaranteed finding was actually
 * injected — otherwise there is nothing for the LLM to have duplicated,
 * and a genuine finding discussing AI training/literacy for some other
 * reason (e.g. as part of a broader governance-maturity observation) must
 * survive untouched.
 */
function dropDuplicateArticle4Findings(findings: TenderReadinessFinding[], article4Guaranteed: boolean): TenderReadinessFinding[] {
  if (!article4Guaranteed) return findings;
  // Widened 2026-08-28 after testing plausible LLM rephrasings directly
  // against this pattern (not just against real Groq output, which
  // happened to come back clean 3/3 times) — the original, narrower
  // pattern missed "no structured training program... for staff using AI
  // tools" and "literacy program" (vs. "literacy training"). `\bliteracy\b`
  // alone is safe to match bare given this module's narrow AI-regulatory
  // scope — verified against 6 genuine, unrelated finding titles
  // (governance/vendor-risk/incident-response findings) with zero false
  // matches.
  const pattern = /ai literacy|\bliteracy\b|article ?4|staff.{0,40}(training|literacy).{0,40}ai|ai.{0,40}(training|literacy).{0,40}staff|training.{0,40}ai tool/i;
  return findings.filter((f) => {
    if (f.findingId === "tender_readiness-article_4_literacy") return true;
    const haystack = `${f.title} ${f.diagnosis}`;
    return !pattern.test(haystack);
  });
}

const SECTION_APPLICABILITY_KEYS: Record<TenderReadinessSection, keyof ReturnType<typeof computeJurisdictionApplicability>> = {
  eu_ai_act: "euAiAct",
  uae_difc_reg10: "uaeDifcReg10",
  saudi_ai_governance: "saudiAiGovernance",
  uae_ai_charter_reference: "uaeAiCharterReference",
};

export async function runTenderReadinessAudit(input: TenderReadinessDraftInput): Promise<TenderReadinessDraftResult> {
  const applicability = computeJurisdictionApplicability(input.company);

  const applicableSections = (Object.keys(SECTION_APPLICABILITY_KEYS) as TenderReadinessSection[]).filter(
    (s) => applicability[SECTION_APPLICABILITY_KEYS[s]],
  );
  const substantiveSections = applicableSections.filter((s) => s !== "uae_ai_charter_reference");

  if (applicableSections.length === 0) {
    return {
      applicability,
      findings: [],
      notes: "No AI-specific jurisdiction currently applies based on this company's registration and customer markets.",
    };
  }

  const findings: TenderReadinessFinding[] = [];
  const hasDocs = Boolean(input.existingDocumentation && input.existingDocumentation.trim().length > 0);
  if (!hasDocs && substantiveSections.length > 0) {
    findings.push(buildNoDocumentationFinding(substantiveSections));
  }

  // Article 4 AI literacy check (Part 8d) — deterministic, independent of
  // whether an AI use-case inventory was submitted at all (it's a
  // structural fact about the company, not about the AI use-case
  // content). Only ever fires when the EU AI Act itself applies AND the
  // client explicitly answered "no."
  const article4Guaranteed = applicability.euAiAct && input.aiLiteracyTrainingProvided === false;
  if (article4Guaranteed) {
    findings.push(buildArticle4LiteracyFinding());
  }

  if (input.aiUseCaseInventory.trim().length > 0) {
    const raw: RawTenderReadinessOutput = await generateValidatedJson(tenderReadinessOutputSchema, {
      schemaName: "tender-readiness",
      messages: [{ role: "system", content: buildPrompt(input.companyId, applicableSections, input, hasDocs) }],
    });

    const llmFindings: TenderReadinessFinding[] = raw.findings.map((f, i) => ({
      findingId: `tender_readiness-${i}`,
      title: f.title,
      diagnosis: f.diagnosis,
      rootCause: f.rootCause,
      recommendedAction: f.recommendedAction,
      severity: f.severity,
      section: f.section,
      evidenceCited: f.evidenceCited,
      confidenceLevel: f.confidenceLevel,
      isMissingDataFinding: f.isMissingDataFinding,
    }));

    findings.push(...dropDuplicateArticle4Findings(dropDuplicateMissingDocumentationFindings(llmFindings, hasDocs), article4Guaranteed));

    return { applicability, findings, notes: raw.notes };
  }

  return { applicability, findings, notes: "No AI use-case inventory submitted — only the missing-documentation gap (if any) could be assessed." };
}

export { computeJurisdictionApplicability } from "./jurisdiction";
export type * from "./types";
