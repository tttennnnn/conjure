import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { buildCodegenSystemPrompt, CODEGEN_TOOL } from "./prompts/codegen";

export interface IacFiles {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
}

interface CodegenParams {
  mermaidCode: string;
  configYaml: string;
  targetEnv: string;
  iacTool: string;
  provider: "openrouter" | "anthropic";
  modelId: string;
  apiKey: string;
}

// Extracts a delimited block from raw text: <<<TAG>>> ... <<<END_TAG>>>
function extractDelimitedBlock(text: string, tag: string): string {
  const open = `<<<${tag}>>>`;
  const close = `<<<END_${tag}>>>`;
  const start = text.indexOf(open);
  const end = text.indexOf(close);
  if (start === -1 || end === -1) return "";
  return text.slice(start + open.length, end).trim();
}

async function codegenOpenRouter(params: CodegenParams): Promise<IacFiles> {
  const client = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: params.apiKey,
  });

  const systemPrompt = buildCodegenSystemPrompt(
    params.mermaidCode,
    params.configYaml,
    params.targetEnv,
    params.iacTool,
    "openrouter",
  );

  const response = await client.chat.completions.create({
    model: params.modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate the Terraform files for this infrastructure." },
    ],
    max_tokens: 8192,
    temperature: 0.1,
  });

  const rawText = response.choices[0]?.message?.content ?? "";

  return {
    mainTf: extractDelimitedBlock(rawText, "MAIN_TF") || rawText,
    variablesTf: extractDelimitedBlock(rawText, "VARIABLES_TF"),
    outputsTf: extractDelimitedBlock(rawText, "OUTPUTS_TF"),
  };
}

async function codegenAnthropic(params: CodegenParams): Promise<IacFiles> {
  const client = new Anthropic({ apiKey: params.apiKey });

  const systemPrompt = buildCodegenSystemPrompt(
    params.mermaidCode,
    params.configYaml,
    params.targetEnv,
    params.iacTool,
    "anthropic",
  );

  const response = await client.messages.create({
    model: params.modelId,
    max_tokens: 8192,
    temperature: 0.1,
    system: systemPrompt,
    messages: [
      { role: "user", content: "Generate the Terraform files for this infrastructure." },
    ],
    tools: [CODEGEN_TOOL],
    tool_choice: { type: "tool", name: "generate_terraform" },
  });

  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "generate_terraform") {
      const input = block.input as {
        mainTf: string;
        variablesTf: string;
        outputsTf: string;
      };
      return {
        mainTf: input.mainTf ?? "",
        variablesTf: input.variablesTf ?? "",
        outputsTf: input.outputsTf ?? "",
      };
    }
  }

  // Fallback: no tool call in response
  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";
  return {
    mainTf: extractDelimitedBlock(raw, "MAIN_TF") || raw,
    variablesTf: extractDelimitedBlock(raw, "VARIABLES_TF"),
    outputsTf: extractDelimitedBlock(raw, "OUTPUTS_TF"),
  };
}

export async function generateCode(params: CodegenParams): Promise<IacFiles> {
  if (params.provider === "anthropic") {
    return codegenAnthropic(params);
  }
  return codegenOpenRouter(params);
}
