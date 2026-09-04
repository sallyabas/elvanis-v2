import { z } from "zod";
import { confidenceLevelSchema, severitySchema } from "@/lib/lenses/schemas";

export const dataProtectionRegulationSchema = z.enum(["uk_gdpr", "eu_gdpr", "saudi_pdpl", "uae_pdpl", "adgm_dpr", "difc_dpl"]);
export const dataProtectionCategorySchema = z.enum([
  "consent_flow",
  "data_subject_rights",
  "retention_policy",
  "breach_response",
  "cross_border_transfer",
]);

export const dataProtectionFindingSchema = z.object({
  title: z.string(),
  diagnosis: z.string(),
  rootCause: z.string(),
  recommendedAction: z.string(),
  severity: severitySchema,
  category: dataProtectionCategorySchema,
  applicableRegulations: z.array(dataProtectionRegulationSchema),
  evidenceCited: z.array(z.string()),
  confidenceLevel: confidenceLevelSchema,
  isMissingDataFinding: z.boolean(),
});

export const dataProtectionOutputSchema = z.object({
  findings: z.array(dataProtectionFindingSchema),
  notes: z.string().optional(),
});

export type RawDataProtectionOutput = z.infer<typeof dataProtectionOutputSchema>;
