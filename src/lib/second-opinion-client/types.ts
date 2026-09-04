export interface SecondOpinionRequest {
  /** The system prompt — the rubric + task instructions the model should follow. */
  system: string;
  /** The single user-turn content — the finding + evidence being reviewed. */
  userMessage: string;
  maxTokens?: number;
}

export interface SecondOpinionCompletionResult {
  /** Raw text response — the caller validates/parses it against its own schema, same "validate what actually came back" discipline as generateValidatedJson in ai-client. */
  text: string;
  model: string;
  provider: string;
}

/**
 * Every second-opinion provider (Anthropic today, anything else later)
 * implements this shape. Nothing outside src/lib/second-opinion-client
 * should import a provider SDK directly — same discipline as
 * src/lib/ai-client for Groq and src/lib/search-client for Tavily.
 */
export interface SecondOpinionProvider {
  readonly name: string;
  complete(request: SecondOpinionRequest): Promise<SecondOpinionCompletionResult>;
}

export class SecondOpinionClientError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SecondOpinionClientError";
  }
}
