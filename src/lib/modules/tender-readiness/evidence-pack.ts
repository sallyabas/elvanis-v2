import { createAdminClient } from "@/lib/supabase/admin";
import { SECTION_LABELS } from "./index";
import { PROCUREMENT_QUESTIONS, type ProcurementCategory } from "./procurement-categories";
import type { TenderReadinessFinding, TenderReadinessSection } from "./types";
import { MODULE_LEGAL_DISCLAIMER } from "@/lib/modules/legal-disclaimer";

/**
 * Minimal evidence-pack export (confirmed 2026-08-05, Priority 3) — the
 * second of the two design questions flagged as genuinely open ("what
 * exactly goes in an evidence pack, and in what format?") is now resolved
 * per explicit direction: a simple structured document, not a complex
 * multi-format system. Real PDF/zip rendering would need a new dependency
 * this codebase doesn't have yet — deliberately deferred, not silently
 * dropped (see the route handler's own doc comment and CLAUDE.md). This
 * produces a Markdown document instead: real content, genuinely
 * downloadable and usable as-is, proving the export concept end-to-end
 * before any format upgrade is justified.
 *
 * Content included, same "never client-facing until reviewed" discipline
 * as every other client-visible surface in this codebase: only
 * reviewer-approved/edited findings and procurement answers are included —
 * never draft or rejected ones, mirroring the exact filter already used by
 * the client-facing Report view (reports/[reportId]/page.tsx).
 */

/**
 * Real corrupted-data bug found live 2026-08-05: at least one existing
 * module_findings row has reviewer_edited_content set to a bare UUID
 * string rather than an edited-content object (pre-existing bad data from
 * an earlier test pass, not written by this code) — trusting it blindly
 * rendered "undefined" for every field in the exported pack. Falls back
 * to the always-valid ai_draft when reviewer_edited_content doesn't look
 * like real finding content. Same fix applied in ModuleReviewWorkspaceClient
 * (the live reviewer UI had the identical vulnerability), plus a write-time
 * guard added to editModuleFinding() to prevent this recurring.
 */
function isValidEditedContent(v: unknown): v is TenderReadinessFinding {
  return !!v && typeof v === "object" && typeof (v as Record<string, unknown>).title === "string" && typeof (v as Record<string, unknown>).diagnosis === "string";
}

function displayedFinding(f: { ai_draft: TenderReadinessFinding; reviewer_edited_content: TenderReadinessFinding | null }): TenderReadinessFinding {
  return isValidEditedContent(f.reviewer_edited_content) ? f.reviewer_edited_content : f.ai_draft;
}

export interface EvidencePackResult {
  filename: string;
  markdown: string;
}

export async function buildTenderReadinessEvidencePack(requestId: string): Promise<EvidencePackResult> {
  const supabase = createAdminClient();

  const { data: request, error: requestError } = await supabase
    .from("module_requests")
    .select("id, module_type, status, created_at, approved_at, intake_data, companies(name)")
    .eq("id", requestId)
    .single();
  if (requestError || !request) throw new Error(`buildTenderReadinessEvidencePack: request not found: ${requestError?.message}`);
  if (request.module_type !== "tender_readiness") throw new Error("Evidence packs are only available for Tender Readiness requests.");
  if (request.status !== "approved" && request.status !== "sent") {
    throw new Error(`buildTenderReadinessEvidencePack: request must be reviewer-approved first (current status: ${request.status})`);
  }

  const company = request.companies as unknown as { name: string } | null;
  const companyName = company?.name ?? "Unknown company";

  const { data: findingRows, error: findingsError } = await supabase
    .from("module_findings")
    .select("id, ai_draft, reviewer_edited_content, reviewer_status")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (findingsError) throw new Error(`buildTenderReadinessEvidencePack: failed to load findings: ${findingsError.message}`);

  const includedFindings = (findingRows ?? [])
    .filter((f) => f.reviewer_status === "approved" || f.reviewer_status === "edited")
    .map((f) => displayedFinding(f as { ai_draft: TenderReadinessFinding; reviewer_edited_content: TenderReadinessFinding | null }));

  const { data: answerRows, error: answersError } = await supabase
    .from("procurement_answers")
    .select("id, category, question, ai_draft_answer, reviewer_edited_answer, regulations_cited, reviewer_status")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (answersError) throw new Error(`buildTenderReadinessEvidencePack: failed to load procurement answers: ${answersError.message}`);

  const includedAnswers = (answerRows ?? []).filter((a) => a.reviewer_status === "approved" || a.reviewer_status === "edited");

  const intakeData = request.intake_data as { applicability?: Record<string, boolean> };
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

  const lines: string[] = [];
  lines.push(`# Tender Readiness Evidence Pack — ${companyName}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Request status: ${request.status}`);
  lines.push("");
  // Exact, non-negotiable disclaimer text (confirmed 2026-08-27,
  // Onboarding Architecture & Path Routing brief, Part 8e) — a liability
  // protection requirement, not copy polish. This is the single most
  // important place for it: the literal document a client could submit
  // into a real procurement process. Reads from the same shared constant
  // as the reviewer/client UI surfaces (extended to all modules 2026-08-31)
  // so this export can never drift from what's shown on-screen.
  lines.push(`**${MODULE_LEGAL_DISCLAIMER}**`);
  lines.push("");

  lines.push("## Applicable regulatory frameworks");
  lines.push("");
  if (applicableSections.length === 0) {
    lines.push("_None determined applicable._");
  } else {
    for (const s of applicableSections) {
      lines.push(`- ${SECTION_LABELS[s] ?? s}`);
    }
  }
  lines.push("");

  lines.push("## Findings");
  lines.push("");
  if (includedFindings.length === 0) {
    lines.push("_No reviewer-approved findings._");
  } else {
    for (const f of includedFindings) {
      lines.push(`### ${f.title}`);
      lines.push("");
      lines.push(`- **Section:** ${SECTION_LABELS[f.section] ?? f.section}`);
      lines.push(`- **Severity:** ${f.severity}`);
      lines.push(`- **Diagnosis:** ${f.diagnosis}`);
      lines.push(`- **Root cause:** ${f.rootCause}`);
      lines.push(`- **Recommended action:** ${f.recommendedAction}`);
      lines.push("");
    }
  }

  lines.push("## Procurement Q&A");
  lines.push("");
  if (includedAnswers.length === 0) {
    lines.push("_No reviewer-approved procurement answers. Generate and review these first in the reviewer workspace._");
  } else {
    for (const a of includedAnswers) {
      const label = PROCUREMENT_QUESTIONS[a.category as ProcurementCategory]?.label ?? a.category;
      const answer = a.reviewer_edited_answer ?? a.ai_draft_answer;
      lines.push(`### ${label}`);
      lines.push("");
      lines.push(`**Q:** ${a.question}`);
      lines.push("");
      lines.push(`**A:** ${answer}`);
      lines.push("");
      if (a.regulations_cited.length > 0) {
        lines.push(`_Cites: ${a.regulations_cited.map((r: string) => SECTION_LABELS[r as TenderReadinessSection] ?? r).join(", ")}_`);
        lines.push("");
      }
    }
  }

  const filenameSafeCompany = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const filename = `tender-readiness-evidence-pack-${filenameSafeCompany || "company"}.md`;

  return { filename, markdown: lines.join("\n") };
}
