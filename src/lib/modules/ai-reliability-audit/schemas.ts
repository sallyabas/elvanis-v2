import { z } from "zod";
import { confidenceLevelSchema, severitySchema } from "@/lib/lenses/schemas";

export const adversarialTestCategorySchema = z.enum(["invented_policy", "data_leakage", "bias", "prompt_injection", "governance_gap"]);

export const aiReliabilityFindingSchema = z.object({
  title: z.string(),
  diagnosis: z.string(),
  rootCause: z.string(),
  recommendedAction: z.string(),
  severity: severitySchema,
  category: adversarialTestCategorySchema,
  evidenceCited: z.array(z.string()),
  confidenceLevel: confidenceLevelSchema,
  isMissingDataFinding: z.boolean(),
});

export const aiReliabilityOutputSchema = z.object({
  findings: z.array(aiReliabilityFindingSchema),
  notes: z.string().optional(),
});

export type RawAiReliabilityOutput = z.infer<typeof aiReliabilityOutputSchema>;
