import type { z } from "zod";
import { aiConfig } from "./config";
import { GroqProvider } from "./providers/groq";
import type {
  AiCompletionOptions,
  AiCompletionResult,
  AiJsonCompletionOptions,
  AiProvider,
} from "./types";
import { AiClientError } from "./types";

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

/**
 * Preferred over `generateJson` for anything with enums/literal unions.
 * Groq's `json_object` mode guarantees valid JSON, not conformance to our
 * schema — it can (and does) hallucinate out-of-enum string values that
 * would otherwise pass through silently. This validates the response and
 * throws a clear error instead, so a malformed draft fails loudly rather
 * than corrupting a reviewer workspace or priority ranking downstream.
 */
export async function generateValidatedJson<T>(
  schema: z.ZodType<T>,
  options: AiJsonCompletionOptions,
): Promise<T> {
  const raw = await getProvider().completeJson<unknown>(options);
  const result = schema.safeParse(raw);

  if (!result.success) {
    throw new AiClientError(
      `Response for "${options.schemaName}" failed schema validation: ${result.error.message}`,
      getProvider().name,
      result.error,
    );
  }

  return result.data;
}
