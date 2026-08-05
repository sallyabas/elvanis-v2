import { generateValidatedJson } from "@/lib/ai-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { confidenceLevelSchema } from "@/lib/lenses/schemas";
import { SECTION_LABELS } from "./index";
import { PROCUREMENT_QUESTIONS, type ProcurementCategory } from "./procurement-categories";
import type { TenderReadinessFinding, TenderReadinessSection } from "./types";

/**
 * Draft procurement-answer generator (confirmed 2026-08-04, Priority 3) —
 * the design question flagged earlier ("what does a procurement answer
 * actually look like?") is now resolved: the spec's own reference sources
 * (Verumt, Flutteris, Legalithm) were never actually researched and their
 * exact formats couldn't be found, but real, cross-source-validated
 * question categories were — multiple independent 2026 AI procurement
 * frameworks converge on the same 11-category structure. These are
 * curated, deterministic questions (not AI-generated), same pattern as AI
 * Reliability Audit's self-test-prompts.ts — only the ANSWER per category
 * is drafted by the model, never the question itself.
 *
 * Generated from reviewer-APPROVED findings only, same reasoning already
 * established for AI Opportunity Synthesis ("synthesizing from findings
 * that might still get edited/rejected would build on sand") — this
 * function only proceeds if the request's own status is already
 * approved/sent, enforced in code before the LLM is ever called.
 *
 * Each answer must cite which applicable regulation(s) it maps to — the
 * SET of regulations eligible to be cited is computed deterministically
 * in code (the request's own already-computed applicability), same
 * "deterministic-in-code, never-AI-judged" pattern used everywhere else
 * in this module; the model drafts the answer text and picks from that
 * fixed set, it never invents an inapplicable citation.
 */

const procurementAnswerSchema = z.object({
  category: z.enum(Object.keys(PROCUREMENT_QUESTIONS) as [ProcurementCategory, ...ProcurementCategory[]]),
  answer: z.string(),
  regulationsCited: z.array(z.string()),
  confidenceLevel: confidenceLevelSchema,
});
const procurementOutputSchema = z.object({ answers: z.array(procurementAnswerSchema) });
type RawProcurementOutput = z.infer<typeof procurementOutputSchema>;

export interface ProcurementAnswerDraft {
  category: ProcurementCategory;
  question: string;
  aiDraftAnswer: string;
  regulationsCited: TenderReadinessSection[];
}

function buildPrompt(
  companyName: string,
  applicableSections: TenderReadinessSection[],
  aiUseCaseInventory: string,
  findings: TenderReadinessFinding[],
): string {
  return `You are drafting draft answers to a real AI procurement questionnaire on behalf of ${companyName}, based on their already-reviewed Tender Readiness audit. You do not decide which regulations apply — that was already determined by code. You draft plausible, evidence-grounded answers a real business could adapt and submit, not final legal representations.

HARD RULES:
1. "regulationsCited" for each answer must be a subset of the applicable regulations listed below — never cite one that isn't listed.
2. Ground every answer in the AI use-case inventory and the reviewed findings below — do not fabricate practices the evidence doesn't support. If the evidence is insufficient to answer confidently, say so honestly in the answer text and set confidenceLevel to "insufficient" rather than inventing detail.
3. Answer every one of the questions listed below, in the same category order.
4. Output strict JSON matching the schema below. No prose outside the JSON.

APPLICABLE REGULATIONS (already determined by code — the only ones you may cite): ${applicableSections.join(", ")}

AI USE-CASE INVENTORY: ${aiUseCaseInventory}

REVIEWED FINDINGS FROM THIS AUDIT:
${findings.map((f) => `- [${f.section}] ${f.title}: ${f.diagnosis}`).join("\n")}

QUESTIONS TO ANSWER:
${Object.entries(PROCUREMENT_QUESTIONS)
  .map(([key, q]) => `- ${key}: ${q.question}`)
  .join("\n")}

OUTPUT SCHEMA (JSON object):
{
  "answers": [
    {
      "category": ${Object.keys(PROCUREMENT_QUESTIONS).map((k) => `"${k}"`).join(" | ")},
      "answer": string,
      "regulationsCited": string[],
      "confidenceLevel": "high" | "medium" | "low" | "insufficient"
    }
  ]
}

Produce your answers now, one per category, following the output schema exactly.`;
}

export interface GenerateProcurementAnswersResult {
  requestId: string;
  answerCount: number;
}

export async function generateAndPersistProcurementAnswers(requestId: string): Promise<GenerateProcurementAnswersResult> {
  const supabase = createAdminClient();

  const { data: request, error: requestError } = await supabase
    .from("module_requests")
    .select("id, module_type, status, company_id, intake_data, companies(name)")
    .eq("id", requestId)
    .single();
  if (requestError || !request) throw new Error(`generateAndPersistProcurementAnswers: request not found: ${requestError?.message}`);
  if (request.module_type !== "tender_readiness") throw new Error("Procurement answers are only available for Tender Readiness requests.");
  if (request.status !== "approved" && request.status !== "sent") {
    throw new Error(`generateAndPersistProcurementAnswers: request must be reviewer-approved first (current status: ${request.status})`);
  }

  const { data: existing } = await supabase.from("procurement_answers").select("id").eq("request_id", requestId).limit(1);
  if (existing && existing.length > 0) throw new Error("Procurement answers already exist for this request.");

  const intakeData = request.intake_data as { aiUseCaseInventory?: string; applicability?: Record<string, boolean> };
  const applicability = intakeData.applicability ?? {};
  const SECTION_APPLICABILITY_KEYS: Record<TenderReadinessSection, string> = {
    eu_ai_act: "euAiAct",
    uae_difc_reg10: "uaeDifcReg10",
    saudi_ai_governance: "saudiAiGovernance",
    uae_ai_charter_reference: "uaeAiCharterReference",
  };
  const applicableSections = (Object.keys(SECTION_APPLICABILITY_KEYS) as TenderReadinessSection[]).filter(
    (s) => applicability[SECTION_APPLICABILITY_KEYS[s]],
  );
  if (applicableSections.length === 0) throw new Error("No applicable regulations — nothing to draft procurement answers against.");

  const { data: findingRows, error: findingsError } = await supabase
    .from("module_findings")
    .select("ai_draft, reviewer_edited_content, reviewer_status")
    .eq("request_id", requestId);
  if (findingsError) throw new Error(`generateAndPersistProcurementAnswers: failed to load findings: ${findingsError.message}`);

  const approvedFindings = (findingRows ?? [])
    .filter((f) => f.reviewer_status === "approved" || f.reviewer_status === "edited")
    .map((f) => (f.reviewer_edited_content ?? f.ai_draft) as TenderReadinessFinding);

  const company = request.companies as unknown as { name: string } | null;

  const raw: RawProcurementOutput = await generateValidatedJson(procurementOutputSchema, {
    schemaName: "tender-readiness-procurement-answers",
    messages: [
      {
        role: "system",
        content: buildPrompt(company?.name ?? "the company", applicableSections, intakeData.aiUseCaseInventory ?? "", approvedFindings),
      },
    ],
  });

  const rows = raw.answers.map((a) => ({
    request_id: requestId,
    category: a.category,
    question: PROCUREMENT_QUESTIONS[a.category].question,
    ai_draft_answer: a.answer,
    regulations_cited: a.regulationsCited.filter((r) => applicableSections.includes(r as TenderReadinessSection)),
  }));

  const { error: insertError } = await supabase.from("procurement_answers").insert(rows);
  if (insertError) throw new Error(`generateAndPersistProcurementAnswers: failed to persist: ${insertError.message}`);

  return { requestId, answerCount: rows.length };
}

export { SECTION_LABELS, PROCUREMENT_QUESTIONS };
export type { ProcurementCategory };
