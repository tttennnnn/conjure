import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { ParsedBlocks, ConversationMessage } from "./types";
import { extractBlocks, stripThinkingBlocks } from "./parse";
import { INFRASTRUCTURE_UPDATE_TOOL } from "./prompts/diagram";

type LLMProvider = "openrouter" | "anthropic";

interface LLMCallOptions {
  provider: LLMProvider;
  modelId: string;
  apiKey: string;
  systemPrompt: string;
  messages: ConversationMessage[];
  disableReasoning?: boolean;
}

function getOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
}

function getAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}

async function callOpenRouter(
  modelId: string,
  apiKey: string,
  systemPrompt: string,
  messages: ConversationMessage[],
  disableReasoning: boolean,
): Promise<ParsedBlocks> {
  const client = getOpenRouterClient(apiKey);

  const response = await client.chat.completions.create({
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ],
    max_tokens: 8192,
    temperature: 0.3,
    stream: false,
    // Only sent for models that embed CoT in content (e.g. Nemotron).
    // Models with mandatory reasoning (e.g. gpt-oss-120b) omit this flag.
    ...(disableReasoning ? { reasoning: { enabled: false } } : {}),
  });

  const rawText = response.choices[0]?.message?.content ?? "";
  return extractBlocks(stripThinkingBlocks(rawText));
}

async function callAnthropic(
  modelId: string,
  apiKey: string,
  systemPrompt: string,
  messages: ConversationMessage[],
): Promise<ParsedBlocks> {
  const client = getAnthropicClient(apiKey);

  // TODO: extended thinking — add thinking:{type:'enabled', budget_tokens:N} here
  // for premium users who want deeper reasoning on complex infrastructure designs.
  // Compatible with tool_use on Sonnet/Opus. Will need a per-model opt-in flag in session setup.
  const response = await client.messages.create({
    model: modelId,
    max_tokens: 4096,
    temperature: 0.3,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools: [INFRASTRUCTURE_UPDATE_TOOL],
    tool_choice: { type: "auto" },
  });

  return parseAnthropicResponse(response);
}

function parseAnthropicResponse(response: Anthropic.Message): ParsedBlocks {
  let chatText = "";
  let mermaidCode: string | null = null;
  let configYaml: string | null = null;

  for (const block of response.content) {
    if (block.type === "text") {
      chatText += block.text;
    } else if (block.type === "tool_use" && block.name === "update_infrastructure") {
      const input = block.input as {
        chatResponse: string;
        mermaidCode?: string;
        configYaml?: string;
      };
      chatText = input.chatResponse;
      mermaidCode = input.mermaidCode ?? null;
      configYaml = input.configYaml ?? null;
    }
  }

  if (!chatText) {
    chatText = "I've updated the infrastructure.";
  }

  return { chatText, mermaidCode, configYaml };
}

export async function callLLM(options: LLMCallOptions): Promise<ParsedBlocks> {
  if (options.provider === "anthropic") {
    return callAnthropic(options.modelId, options.apiKey, options.systemPrompt, options.messages);
  }
  return callOpenRouter(options.modelId, options.apiKey, options.systemPrompt, options.messages, options.disableReasoning ?? false);
}
