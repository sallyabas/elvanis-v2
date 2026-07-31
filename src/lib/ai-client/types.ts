export type AiMessageRole = "system" | "user" | "assistant";

export interface AiMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiCompletionOptions {
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface AiJsonCompletionOptions extends AiCompletionOptions {
  /** Short label used in error messages and provider logs, e.g. "financial-lens". */
  schemaName: string;
}

export interface AiCompletionResult {
  text: string;
  model: string;
  provider: string;
}

/**
 * Every provider (Groq today, anything else later) implements this shape.
 * Nothing outside src/lib/ai-client should import a provider SDK directly.
 */
export interface AiProvider {
  readonly name: string;
  complete(options: AiCompletionOptions): Promise<AiCompletionResult>;
  completeJson<T>(options: AiJsonCompletionOptions): Promise<T>;
}

export class AiClientError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiClientError";
  }
}
