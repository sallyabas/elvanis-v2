// Matches evidence_submissions / evidence_files / evidence_fields in
// supabase/migrations — see spec §2.3 step 2, §3.

export type EvidenceSourceType = "native_export" | "template_fill" | "merged";
export type EvidenceSubmissionStatus = "pending" | "complete" | "insufficient";

export interface EvidenceField {
  fieldName: string;
  fieldValue: string | null;
  source: "parsed" | "manual";
  isRequired: boolean;
  isBlank: boolean;
}
