/**
 * Single source of truth for which model backs the reviewer's "second
 * opinion" feature (confirmed 2026-09-04) — a deliberately SEPARATE
 * configuration from src/lib/ai-client's own (Groq), not a toggle on that
 * shared singleton. The entire point of a "second opinion" is genuine
 * model-independence from the model that drafted the finding in the first
 * place — Groq drafts, Claude reviews — so this app needs to run two
 * providers side by side, which ai-client's own single-cached-provider
 * design doesn't support without changing shared, load-bearing
 * infrastructure every lens/module already depends on. A small, separate
 * client (same pattern as search-client for Tavily) avoids that risk
 * entirely.
 */
export const secondOpinionConfig = {
  provider: process.env.SECOND_OPINION_PROVIDER ?? "anthropic",
  model: process.env.SECOND_OPINION_MODEL ?? "claude-sonnet-5",
  defaultMaxTokens: 2048,
} as const;
