import { createAdminClient } from "@/lib/supabase/admin";
import { REGULATION_LABELS } from "./index";
import type { DataProtectionFinding, DataProtectionRegulation, DataProtectionCategory } from "./types";
import { MODULE_LEGAL_DISCLAIMER } from "@/lib/modules/legal-disclaimer";

/**
 * Evidence-pack export, extended from Tender Readiness's own (confirmed
 * 2026-09-05, code-quality audit item 5) — same "reviewer-approved/edited
 * only, Markdown, minimal" design, same corrupted-`reviewer_edited_content`
 * defensive guard (see tender-readiness/evidence-pack.ts's own docblock for
 * the original real bug this pattern exists to prevent). No procurement
 * Q&A section here — that mechanism is Tender-Readiness-specific
 * (`procurement_answers` has no Data Protection Compliance equivalent).
 */

const CATEGORY_LABELS: Record<DataProtectionCategory, string> = {
  consent_flow: "Consent flow",
  data_subject_rights: "Data-subject rights readiness",
  retention_policy: "Retention policy",
  breach_response: "Breach-response readiness",
  cross_border_transfer: "Cross-border transfer",
};

function isValidEditedContent(v: unknown): v is DataProtectionFinding {
  return !!v && typeof v === "object" && typeof (v as Record<string, unknown>).title === "string" && typeof (v as Record<string, unknown>).diagnosis === "string";
}

function displayedFinding(f: { ai_draft: DataProtectionFinding; reviewer_edited_content: DataProtectionFinding | null }): DataProtectionFinding {
  return isValidEditedContent(f.reviewer_edited_content) ? f.reviewer_edited_content : f.ai_draft;
}

export interface EvidencePackResult {
  filename: string;
  markdown: string;
}

export async function buildDataProtectionEvidencePack(requestId: string): Promise<EvidencePackResult> {
  const supabase = createAdminClient();

  const { data: request, error: requestError } = await supabase
    .from("module_requests")
    .select("id, module_type, status, intake_data, companies(name)")
    .eq("id", requestId)
    .single();
  if (requestError || !request) throw new Error(`buildDataProtectionEvidencePack: request not found: ${requestError?.message}`);
  if (request.module_type !== "data_protection") throw new Error("This evidence pack builder is only for Data Protection Compliance requests.");
  if (request.status !== "approved" && request.status !== "sent") {
    throw new Error(`buildDataProtectionEvidencePack: request must be reviewer-approved first (current status: ${request.status})`);
  }

  const company = request.companies as unknown as { name: string } | null;
  const companyName = company?.name ?? "Unknown company";

  const { data: findingRows, error: findingsError } = await supabase
    .from("module_findings")
    .select("id, ai_draft, reviewer_edited_content, reviewer_status")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });
  if (findingsError) throw new Error(`buildDataProtectionEvidencePack: failed to load findings: ${findingsError.message}`);

  const includedFindings = (findingRows ?? [])
    .filter((f) => f.reviewer_status === "approved" || f.reviewer_status === "edited")
    .map((f) => displayedFinding(f as { ai_draft: DataProtectionFinding; reviewer_edited_content: DataProtectionFinding | null }));

  const intakeData = request.intake_data as { applicability?: Record<string, DataProtectionRegulation | boolean> } | Record<string, unknown>;
  const applicability = (intakeData as { applicability?: Record<string, boolean> }).applicability ?? {};
  const APPLICABILITY_KEYS: Record<DataProtectionRegulation, string> = {
    uk_gdpr: "ukGdpr",
    eu_gdpr: "euGdpr",
    saudi_pdpl: "saudiPdpl",
    uae_pdpl: "uaePdpl",
    adgm_dpr: "adgmDpr",
    difc_dpl: "difcDpl",
  };
  const applicableRegulations = (Object.keys(APPLICABILITY_KEYS) as DataProtectionRegulation[]).filter((r) => applicability[APPLICABILITY_KEYS[r]]);

  const lines: string[] = [];
  lines.push(`# Data Protection Compliance Evidence Pack — ${companyName}`);
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Request status: ${request.status}`);
  lines.push("");
  lines.push(`**${MODULE_LEGAL_DISCLAIMER}**`);
  lines.push("");

  lines.push("## Applicable regulations");
  lines.push("");
  if (applicableRegulations.length === 0) {
    lines.push("_None determined applicable._");
  } else {
    for (const r of applicableRegulations) {
      lines.push(`- ${REGULATION_LABELS[r] ?? r}`);
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
      lines.push(`- **Category:** ${CATEGORY_LABELS[f.category] ?? f.category}`);
      lines.push(`- **Severity:** ${f.severity}`);
      lines.push(`- **Diagnosis:** ${f.diagnosis}`);
      lines.push(`- **Root cause:** ${f.rootCause}`);
      lines.push(`- **Recommended action:** ${f.recommendedAction}`);
      if (f.applicableRegulations?.length > 0) {
        lines.push(`- **Regulations cited:** ${f.applicableRegulations.map((r) => REGULATION_LABELS[r] ?? r).join(", ")}`);
      }
      lines.push("");
    }
  }

  const filenameSafeCompany = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const filename = `data-protection-compliance-evidence-pack-${filenameSafeCompany || "company"}.md`;

  return { filename, markdown: lines.join("\n") };
}
