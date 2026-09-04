import Anthropic from "@anthropic-ai/sdk";
import { secondOpinionConfig } from "../config";
import type { SecondOpinionRequest, SecondOpinionCompletionResult, SecondOpinionProvider } from "../types";
import { SecondOpinionClientError } from "../types";

export class AnthropicProvider implements SecondOpinionProvider {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(apiKey: string = process.env.ANTHROPIC_API_KEY ?? "") {
    if (!apiKey) {
      throw new SecondOpinionClientError("ANTHROPIC_API_KEY is not set", "anthropic");
    }
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: SecondOpinionRequest): Promise<SecondOpinionCompletionResult> {
    try {
      const response = await this.client.messages.create({
        model: secondOpinionConfig.model,
        max_tokens: request.maxTokens ?? secondOpinionConfig.defaultMaxTokens,
        system: request.system,
        messages: [{ role: "user", content: request.userMessage }],
      });

      const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
      const text = textBlock?.text ?? "";
      return { text, model: secondOpinionConfig.model, provider: this.name };
    } catch (cause) {
      if (cause instanceof SecondOpinionClientError) throw cause;
      throw new SecondOpinionClientError("Anthropic completion failed", this.name, cause);
    }
  }
}
