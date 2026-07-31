/**
 * Single source of truth for which provider/model backs every AI call.
 * Change the provider or model here (or via env) — never at a call site.
 */
export const aiConfig = {
  provider: process.env.AI_PROVIDER ?? "groq",
  model: process.env.AI_MODEL ?? "llama-3.3-70b-versatile",
  defaultTemperature: 0.2,
  defaultMaxTokens: 4096,
} as const;
