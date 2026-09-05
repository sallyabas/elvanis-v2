import { createAdminClient } from "@/lib/supabase/admin";
import type { AiReliabilityFinding, AiReliabilitySystemType } from "./types";
import { MODULE_LEGAL_DISCLAIMER } from "@/lib/modules/legal-disclaimer";

/**
 * Evidence-pack export, extended from Tender Readiness's own (confirmed
 * 2026-09-05, code-quality audit item 5) — same "reviewer-approved/edited
 * only, Markdown, minimal" design. No applicability/jurisdiction section
 * here — this module is evidence-based, not jurisdiction-driven, by design
 * (confirmed elsewhere in this codebase). The one piece of real intake
 * context worth including is which system type (conversational vs.
 * agent/automation) was tested, since that determines what evidence was
 * even possible to submit.
 */

const CATEGORY_LABELS: Record<string, string> = {
  invented_policy: "Invented policy",
  data_leakage: "Data leakage",
  bias: "Bias",
  prompt_injection: "Prompt injection",
  governance_gap: "Governance gap",
};

function isValidEditedContent(v: unknown): v is AiReliabilityFinding {
  return !!v && typeof v === "object" && typeof (v as Record<string, unknown>).title === "string" && typeof (v as Record<string, unknown>).diagnosis === "string";
}

function displayedFinding(f: { ai_draft: AiReliabilityFinding; reviewer_edited_content: AiReliabilityFinding | null }): AiReliabilityFinding {
  return isValidEditedContent(f.reviewer_edited_content) ? f.reviewer_edited_content : f.ai_draft;
}

export interface EvidencePackResult {
  filename: string;
  markdown: string;
}

export async function buildAiReliabilityEvidencePack(requestId: string): Promise<EvidencePackResult> {
  const supabase = createAdminClient();

  const { data: request, error: requestError } = await supabase
    .from("module_requests")
    .select("id, module_type, status, intake_data, companies(name)")
    .eq("id", requestId)
    .single();
  if (requestError || !request) throw new Error(`buildAiReliabilityEvidencePack: request not found: ${requestError?.message}`);
  if (request.module_type !== "ai_reliability") throw new Error("This evidence pack builder is only for AI Reliability Audit requests.");
  if (request.status !== "approved" && request.status !== "sent") {
    throw new Error(`buildAiReliabilityEvidencePack: request must be reviewer-approved first (current status: ${request.status})`);
  }

  const company = request.companies as unknown as { name: string } | null;
  const companyName = company?.name ?? "Unknown company";

  const { data: findingRows, error: findingsError } = await supabase
    .from("module_findings")
    .select("id, ai_draft, reviewer_edited_content, reviewer_status")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (findingsError) throw new Error(`buildAiReliabilityEvidencePack: failed to load findings: ${findingsError.message}`);

  const includedFindings = (findingRows ?? [])
    .filter((f) => f.reviewer_status === "approved" || f.reviewer_status === "edited")
    .map((f) => displayedFinding(f as { ai_draft: AiReliabilityFinding; reviewer_edited_content: AiReliabilityFinding | null }));

  const intakeData = request.intake_data as { systemType?: AiReliabilitySystemType };
  const systemTypeLabel =
    intakeData.systemType === "conversational" ? "Conversational (chatbot)" : intakeData.systemType === "agent_automation" ? "Agent / automation" : "Unknown";

  const lines: string[] = [];
  lines.push(`# AI Reliability Audit Evidence Pack — ${companyName}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Request status: ${request.status}`);
  lines.push(`System type tested: ${systemTypeLabel}`);
  lines.push("");
  lines.push(`**${MODULE_LEGAL_DISCLAIMER}**`);
  lines.push("");

  lines.push("## Findings");
  lines.push("");
  if (includedFindings.length === 0) {
    lines.push("_No reviewer-approved findings._");
  } else {
    for (const f of includedFindings) {
      lines.push(`### ${f.title}`);
      lines.push("");
      lines.push(`- **Category:** ${CATEGORY_LABELS[f.category] ?? f.category}`);
      lines.push(`- **Severity:** ${f.severity}`);
      lines.push(`- **Diagnosis:** ${f.diagnosis}`);
      lines.push(`- **Root cause:** ${f.rootCause}`);
      lines.push(`- **Recommended action:** ${f.recommendedAction}`);
      lines.push("");
    }
  }

  const filenameSafeCompany = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const filename = `ai-reliability-audit-evidence-pack-${filenameSafeCompany || "company"}.md`;

  return { filename, markdown: lines.join("\n") };
}
