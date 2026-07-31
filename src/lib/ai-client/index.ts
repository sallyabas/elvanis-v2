import { aiConfig } from "./config";
import { GroqProvider } from "./providers/groq";
import type {
  AiCompletionOptions,
  AiCompletionResult,
  AiJsonCompletionOptions,
  AiProvider,
} from "./types";

export { AiClientError } from "./types";
export type {
  AiMessage,
  AiCompletionOptions,
  AiJsonCompletionOptions,
  AiCompletionResult,
} from "./types";

/**
 * The ai-client abstraction. This is the ONLY place in the codebase allowed
 * to import a provider SDK (groq-sdk today). Every lens prompt, synthesis
 * pass, and module (Tender Readiness, AI Reliability, Data Protection) must
 * call `generateText` / `generateJson` from here — never a provider SDK
 * directly. Swapping providers/models is a change to `config.ts` + adding a
 * provider file, not a rewrite of call sites.
 */
let cachedProvider: AiProvider | undefined;

function getProvider(): AiProvider {
  if (cachedProvider) return cachedProvider;

  switch (aiConfig.provider) {
    case "groq":
      cachedProvider = new GroqProvider();
      break;
    default:
      throw new Error(`Unknown AI provider configured: "${aiConfig.provider}"`);
  }

  return cachedProvider;
}

export async function generateText(options: AiCompletionOptions): Promise<AiCompletionResult> {
  return getProvider().complete(options);
}

export async function generateJson<T>(options: AiJsonCompletionOptions): Promise<T> {
  return getProvider().completeJson<T>(options);
}
