import type { ConfidenceLevel, Severity } from "@/lib/lenses/types";
import type { CompanyJurisdictionInput, JurisdictionApplicability } from "./jurisdiction";

/**
 * Data Protection Compliance (spec §1.8d, confirmed 2026-08-02; extended
 * 2026-08-03 with Saudi PDPL) — GDPR-first build order (§1.8a), broader
 * and AI-agnostic (applies to any company handling personal data, whether
 * or not it uses AI), never AI-specific governance content (Tender
 * Readiness's job). Applicability is deterministic (jurisdiction.ts); the
 * AI's job is narrower — draft content within whatever regulation(s) code
 * has already determined apply.
 *
 * Saudi PDPL is a real, built branch, not a placeholder — PDPL is already
 * actively enforced today, not gated on future Gulf market entry. The
 * UAE's data-protection regime (federal PDPL, ADGM DPR 2021) remains out
 * of scope, genuinely gated on Gulf entry.
 */
export type DataProtectionRegulation = "uk_gdpr" | "eu_gdpr" | "saudi_pdpl";

/** The five core checklist areas (spec §1.8a/§5 task breakdown) — every applicable regulation (GDPR variants and PDPL alike) is assessed across all five, not a per-regulation subset. */
export type DataProtectionCategory =
  | "consent_flow"
  | "data_subject_rights"
  | "retention_policy"
  | "breach_response"
  | "cross_border_transfer";

export interface DataProtectionFinding {
  findingId: string;
  title: string;
  diagnosis: string;
  rootCause: string;
  recommendedAction: string;
  severity: Severity;
  category: DataProtectionCategory;
  applicableRegulations: DataProtectionRegulation[];
  evidenceCited: string[];
  confidenceLevel: ConfidenceLevel;
  isMissingDataFinding: boolean;
}

/** Per-category free-text evidence — a blank category is itself meaningful (nothing in place for that area yet), not an intake error. */
export interface DataProtectionCategoryEvidence {
  consentFlow: string | null;
  dataSubjectRights: string | null;
  retentionPolicy: string | null;
  breachResponse: string | null;
  crossBorderTransfer: string | null;
}

export interface DataProtectionDraftInput {
  companyId: string;
  company: CompanyJurisdictionInput;
  evidence: DataProtectionCategoryEvidence;
  /**
   * Real document upload (confirmed 2026-08-12) — extracted text from a
   * real uploaded privacy policy / documentation file (PDF/DOCX), shared
   * across all 5 categories rather than tied to one, since a real policy
   * document naturally covers several of them at once. Null when no
   * document was uploaded — the module's existing per-category typed-text
   * behavior is completely unchanged in that case.
   */
  existingDocumentationText: string | null;
}

export interface DataProtectionDraftResult {
  applicability: JurisdictionApplicability;
  findings: DataProtectionFinding[];
  notes?: string;
}
