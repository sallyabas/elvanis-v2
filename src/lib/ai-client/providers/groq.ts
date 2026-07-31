import Groq from "groq-sdk";
import { aiConfig } from "../config";
import type {
  AiCompletionOptions,
  AiCompletionResult,
  AiJsonCompletionOptions,
  AiProvider,
} from "../types";
import { AiClientError } from "../types";

export class GroqProvider implements AiProvider {
  readonly name = "groq";
  private client: Groq;

  constructor(apiKey: string = process.env.GROQ_API_KEY ?? "") {
    if (!apiKey) {
      throw new AiClientError("GROQ_API_KEY is not set", "groq");
    }
    this.client = new Groq({ apiKey });
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    try {
      const response = await this.client.chat.completions.create({
        model: aiConfig.model,
        messages: options.messages,
        temperature: options.temperature ?? aiConfig.defaultTemperature,
        max_tokens: options.maxTokens ?? aiConfig.defaultMaxTokens,
      });

      const text = response.choices[0]?.message?.content ?? "";
      return { text, model: aiConfig.model, provider: this.name };
    } catch (cause) {
      throw new AiClientError("Groq completion failed", this.name, cause);
    }
  }

  async completeJson<T>(options: AiJsonCompletionOptions): Promise<T> {
    try {
      const response = await this.client.chat.completions.create({
        model: aiConfig.model,
        messages: options.messages,
        temperature: options.temperature ?? aiConfig.defaultTemperature,
        max_tokens: options.maxTokens ?? aiConfig.defaultMaxTokens,
        response_format: { type: "json_object" },
      });

      const raw = response.choices[0]?.message?.content ?? "";
      try {
        return JSON.parse(raw) as T;
      } catch (parseError) {
        throw new AiClientError(
          `Groq returned non-JSON output for "${options.schemaName}"`,
          this.name,
          parseError,
        );
      }
    } catch (cause) {
      if (cause instanceof AiClientError) throw cause;
      throw new AiClientError(
        `Groq JSON completion failed for "${options.schemaName}"`,
        this.name,
        cause,
      );
    }
  }
}
