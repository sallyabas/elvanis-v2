import { z } from "zod";
import { confidenceLevelSchema, severitySchema } from "@/lib/lenses/schemas";

export const tenderReadinessSectionSchema = z.enum(["eu_ai_act", "uae_difc_reg10", "saudi_ai_governance", "uae_ai_charter_reference"]);

export const tenderReadinessFindingSchema = z.object({
  title: z.string(),
  diagnosis: z.string(),
  rootCause: z.string(),
  recommendedAction: z.string(),
  severity: severitySchema,
  section: tenderReadinessSectionSchema,
  evidenceCited: z.array(z.string()),
  confidenceLevel: confidenceLevelSchema,
  isMissingDataFinding: z.boolean(),
});

export const tenderReadinessOutputSchema = z.object({
  findings: z.array(tenderReadinessFindingSchema),
  notes: z.string().optional(),
});

export type RawTenderReadinessOutput = z.infer<typeof tenderReadinessOutputSchema>;
