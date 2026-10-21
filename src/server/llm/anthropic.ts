import Anthropic from "@anthropic-ai/sdk";
import { ProviderError, type CompleteRequest, type CompleteResult, type LlmProvider } from "./provider.js";

export const MODEL = "claude-haiku-5-5" as const;

/** The slice of the SDK we use; tests pass a stub. */
export interface AnthropicLike { messages: { create(body: any, opts?: any): Promise<any> } }

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  readonly model = MODEL;
  private client: AnthropicLike;
  constructor(apiKeyOrClient: string | AnthropicLike) {
    this.client = typeof apiKeyOrClient === "string" ? (new Anthropic({ apiKey: apiKeyOrClient, timeout: 20_000, maxRetries: 0 }) as unknown as AnthropicLike) : apiKeyOrClient;
  }

  async complete(req: CompleteRequest): Promise<CompleteResult> {
    let res: any;
    try {
      res = await this.client.messages.create(
        {
          model: MODEL,
          max_tokens: Math.min(req.maxTokens, 2048),
          system: req.system,
          messages: req.messages,
          tools: req.tools,
          tool_choice: { type: "auto" },
          output_config: { effort: "low" }, // no `thinking` field, no prefill
        },
        { timeout: 20_000 },
      );
    } catch (e) {
      throw mapError(e);
    }
    const toolCalls: CompleteResult["toolCalls"] = [];
    let text = "";
    for (const b of res.content ?? []) {
      if (b.type === "text") text += b.text;
      if (b.type === "tool_use") {
        let input: Record<string, unknown>;
        try { input = typeof b.input === "string" ? JSON.parse(b.input) : b.input; }
        catch { throw new ProviderError("parse", "Tool input was not valid JSON", true); }
        toolCalls.push({ id: b.id, name: b.name, input });
      }
    }
    return { text: text || undefined, toolCalls, usage: { input_tokens: res.usage?.input_tokens ?? 0, output_tokens: res.usage?.output_tokens ?? 0 } };
  }
}

/** RateLimitError, then APIStatusError, then APIConnectionError (the SDK's subclass order). */
export function mapError(e: unknown): ProviderError {
  if (e instanceof ProviderError) return e;
  if (e instanceof Anthropic.RateLimitError) return new ProviderError("rate_limit", "The language model is busy", true);
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new ProviderError("timeout", "The language model timed out", true);
  if (e instanceof Anthropic.APIError && (e as any).status !== undefined) return new ProviderError("status", `Model error ${(e as any).status}`, false);
  if (e instanceof Anthropic.APIConnectionError) return new ProviderError("connection", "Could not reach the language model", true);
  return new ProviderError("connection", (e as Error)?.message ?? "Model call failed", false);
}
