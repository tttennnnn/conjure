import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { buildImportSystemPrompt, IMPORT_TOOL } from "./prompts/import";
import { extractBlocks, stripThinkingBlocks } from "./parse";
import { parseLLMResponse } from "./parse";

export interface ImportResult {
  mermaidCode: string;
  configYaml: string;
}

interface ImportParams {
  hclContent: string;
  targetEnv: string;
  iacTool: string;
  provider: "openrouter" | "anthropic";
  modelId: string;
  apiKey: string;
  disableReasoning: boolean;
}

async function importOpenRouter(params: ImportParams): Promise<ImportResult> {
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: params.apiKey,
  });

  const systemPrompt = buildImportSystemPrompt(params.targetEnv, params.iacTool, "openrouter");

  const response = await client.chat.completions.create({
    model: params.modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Parse this Terraform infrastructure and generate the diagram and config:\n\n${params.hclContent}` },
    ],
    max_tokens: 8192,
    temperature: 0.1,
    ...(params.disableReasoning ? { reasoning: { enabled: false } } : {}),
  });

  const rawText = response.choices[0]?.message?.content ?? "";
  const blocks = extractBlocks(stripThinkingBlocks(rawText));
  return validateImportBlocks(blocks.mermaidCode, blocks.configYaml);
}

async function importAnthropic(params: ImportParams): Promise<ImportResult> {
  const client = new Anthropic({ apiKey: params.apiKey });

  const systemPrompt = buildImportSystemPrompt(params.targetEnv, params.iacTool, "anthropic");

  const response = await client.messages.create({
    model: params.modelId,
    max_tokens: 8192,
    temperature: 0.1,
    system: systemPrompt,
    messages: [
      { role: "user", content: `Parse this Terraform infrastructure and generate the diagram and config:\n\n${params.hclContent}` },
    ],
    tools: [IMPORT_TOOL],
    tool_choice: { type: "tool", name: "import_infrastructure" },
  });

  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "import_infrastructure") {
      const input = block.input as { mermaidCode: string; configYaml: string };
      return validateImportBlocks(input.mermaidCode, input.configYaml);
    }
  }

  // Fallback: no tool call — try parsing text response
  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";
  const blocks = extractBlocks(raw);
  return validateImportBlocks(blocks.mermaidCode, blocks.configYaml);
}

function validateImportBlocks(
  mermaidCode: string | null,
  configYaml: string | null,
): ImportResult {
  // parseLLMResponse validates both blocks and checks node ID sync
  const result = parseLLMResponse(
    { chatText: "", mermaidCode, configYaml },
    "",
    "",
  );

  if (!result.mermaid || !result.configYaml) {
    const warnings = result.validationWarnings.join("; ");
    throw new Error(
      warnings
        ? `Import failed — invalid diagram or config: ${warnings}`
        : "Import failed — no diagram or config returned by LLM",
    );
  }

  return { mermaidCode: result.mermaid, configYaml: result.configYaml };
}

export async function importFromHcl(params: ImportParams): Promise<ImportResult> {
  if (params.provider === "anthropic") {
    return importAnthropic(params);
  }
  return importOpenRouter(params);
}
