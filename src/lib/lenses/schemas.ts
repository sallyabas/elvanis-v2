import { z } from "zod";

// Zod mirrors of the shared literal unions in ./types — used to validate
// every lens's raw AI output before it's trusted anywhere downstream. See
// AiClientError / generateValidatedJson in src/lib/ai-client: Groq's
// json_object mode guarantees valid JSON, not conformance to these enums.

export const confidenceLevelSchema = z.enum(["high", "medium", "low", "insufficient"]);
export const evidenceSufficiencySchema = z.enum(["sufficient", "partial", "insufficient"]);
export const goalRelevanceSchema = z.enum(["directly_blocks", "directly_supports", "indirectly_affects", "unrelated"]);
export const findingOriginSchema = z.enum(["client_reported", "ai_independent"]);
export const severitySchema = z.enum(["critical", "high", "medium", "low"]);

export const financialImpactSchema = z
  .object({
    impactBandLow: z.number(),
    impactBandHigh: z.number(),
    currency: z.string(),
    confidenceLevel: confidenceLevelSchema,
    assumptions: z.array(z.string()),
  })
  .nullable();
