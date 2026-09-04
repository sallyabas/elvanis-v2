import { secondOpinionConfig } from "./config";
import { AnthropicProvider } from "./providers/anthropic";
import type { SecondOpinionProvider, SecondOpinionRequest, SecondOpinionCompletionResult } from "./types";

export { SecondOpinionClientError } from "./types";
export type { SecondOpinionRequest, SecondOpinionCompletionResult } from "./types";

/**
 * The second-opinion-client abstraction (confirmed 2026-09-04) — this is
 * the ONLY place in the codebase allowed to import the Anthropic SDK.
 * Deliberately separate from src/lib/ai-client (Groq, used for every
 * lens/module drafting call) rather than a config toggle on it — see
 * config.ts's own docblock for the full reasoning (genuine model
 * independence for a "second opinion" tool, and avoiding any change to
 * ai-client's shared, load-bearing singleton). Every caller of the
 * reviewer's second-opinion feature must go through
 * requestSecondOpinionCompletion() here — never a provider SDK directly.
 */
let cachedProvider: SecondOpinionProvider | undefined;

function getProvider(): SecondOpinionProvider {
  if (cachedProvider) return cachedProvider;

  switch (secondOpinionConfig.provider) {
    case "anthropic":
      cachedProvider = new AnthropicProvider();
      break;
    default:
      throw new Error(`Unknown second-opinion provider configured: "${secondOpinionConfig.provider}"`);
  }

  return cachedProvider;
}

export async function requestSecondOpinionCompletion(request: SecondOpinionRequest): Promise<SecondOpinionCompletionResult> {
  return getProvider().complete(request);
}
