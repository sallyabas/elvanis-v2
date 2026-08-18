/**
 * Single source of truth for which provider/model backs every AI call.
 * Change the provider or model here (or via env) — never at a call site.
 *
 * Model swapped 2026-08-18 — real production incident, not a preference
 * change: `llama-3.3-70b-versatile` was fully removed from Groq's
 * available models for this API key (confirmed via a direct GET /v1/models
 * call — genuinely gone, not a rate limit or transient failure), breaking
 * every real AI call in the app (every lens, all three modules, Execution
 * Sprint task-drafting). Replaced with `openai/gpt-oss-20b` after a real
 * side-by-side comparison against `qwen/qwen3.6-27b` across 3 real prompts
 * already used in this codebase (the Financial lens, AI Reliability
 * Audit's conversational mode, and Execution Sprint task-drafting) —
 * openai/gpt-oss-20b passed cleanly twice in a row (correct JSON, correct
 * benchmark-comparison honoring, correct PASS/FAIL classification with
 * zero spurious findings, well-scoped tasks in range); qwen/qwen3.6-27b
 * failed the Financial lens with a genuine Groq-side `json_validate_failed`
 * and failed AI Reliability's conversational mode entirely with "No user
 * query found in messages" — a real, structural chat-template
 * incompatibility with this codebase's existing system-only-message
 * pattern (4 real call sites across Tender Readiness, Data Protection
 * Compliance, and AI Reliability Audit build their entire prompt as one
 * system-role message, no separate user message — working fine on
 * llama-3.3 and openai/gpt-oss-20b, but rejected outright by qwen's chat
 * template). Deliberately NOT `openai/gpt-oss-120b` — this codebase has a
 * separate, already-documented real prior failure with that exact model
 * under strict JSON schema mode (fully reverted at the time); this app's
 * Groq calls use soft `json_object` mode, not strict schema mode, so that
 * specific failure mode doesn't directly apply here, but -120b wasn't
 * re-tested and isn't the safe default to reach for again without its own
 * comparison. `generateValidatedJson`'s schema-validation safety net
 * (built after that original incident) is real and active regardless of
 * which model is configured — it would catch a schema violation rather
 * than let it through silently, but a model that reliably produces
 * correct output the first time is still the better default.
 */
export const aiConfig = {
  provider: process.env.AI_PROVIDER ?? "groq",
  model: process.env.AI_MODEL ?? "openai/gpt-oss-20b",
  defaultTemperature: 0.2,
  defaultMaxTokens: 4096,
} as const;
