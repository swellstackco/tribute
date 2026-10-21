export type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface Message { role: "user" | "assistant"; content: string | Block[] }
export interface ToolSpec { name: string; description: string; input_schema: Record<string, unknown> }
export interface ToolCall { id: string; name: string; input: Record<string, unknown> }
export interface Usage { input_tokens: number; output_tokens: number }

export interface CompleteRequest { system: string; messages: Message[]; tools: ToolSpec[]; maxTokens: number }
export interface CompleteResult { text?: string; toolCalls: ToolCall[]; usage: Usage }

export interface LlmProvider {
  readonly name: string; // "mock" | "anthropic"
  readonly model: string;
  complete(req: CompleteRequest): Promise<CompleteResult>;
}

export class ProviderError extends Error {
  constructor(public kind: "rate_limit" | "status" | "connection" | "timeout" | "parse" | "spend_cap", message: string, public retryable = false) {
    super(message);
  }
}
