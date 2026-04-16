import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { buildCodegenSystemPrompt, CODEGEN_TOOL } from "./prompts/codegen";
import { extractDelimitedBlock } from "./parse";
import { validateCodegenOutput } from "./codegen-parse";

export interface IacFiles {
  mainTf: string;
  variablesTf: string;
  outputsTf: string;
}

export interface CodegenParams {
  mermaidCode: string;
  configYaml: string;
  targetEnv: string;
  iacTool: string;
  provider: "openrouter" | "anthropic";
  modelId: string;
  apiKey: string;
  disableReasoning: boolean;
}

type CodegenCallParams = CodegenParams & { correctiveNote?: string };

function buildUserMessage(correctiveNote?: string): string {
  const base = "Generate the Terraform files for this infrastructure.";
  return correctiveNote ? `${base} ${correctiveNote}` : base;
}

async function codegenOpenRouter(params: CodegenCallParams): Promise<IacFiles> {
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

  const userMessage = buildUserMessage(params.correctiveNote);

  const response = await client.chat.completions.create({
    model: params.modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    max_tokens: 8192,
    temperature: 0.1,
    ...(params.disableReasoning ? { reasoning: { enabled: false } } : {}),
  });

  const rawText = response.choices[0]?.message?.content ?? "";

  return {
    mainTf: extractDelimitedBlock(rawText, "MAIN_TF") || rawText,
    variablesTf: extractDelimitedBlock(rawText, "VARIABLES_TF"),
    outputsTf: extractDelimitedBlock(rawText, "OUTPUTS_TF"),
  };
}

async function codegenAnthropic(params: CodegenCallParams): Promise<IacFiles> {
  const client = new Anthropic({ apiKey: params.apiKey });

  const systemPrompt = buildCodegenSystemPrompt(
    params.mermaidCode,
    params.configYaml,
    params.targetEnv,
    params.iacTool,
    "anthropic",
  );

  const userMessage = buildUserMessage(params.correctiveNote);

  const response = await client.messages.create({
    model: params.modelId,
    max_tokens: 8192,
    temperature: 0.1,
    system: systemPrompt,
    messages: [
      { role: "user", content: userMessage },
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
  const attempt = async (correctiveNote?: string): Promise<IacFiles> => {
    const p = { ...params, correctiveNote };
    return p.provider === "anthropic" ? codegenAnthropic(p) : codegenOpenRouter(p);
  };

  const files = await attempt();
  const validation = validateCodegenOutput(files, params.configYaml);
  if (validation.valid) return files;

  const corrective = `Fix these issues from a previous attempt: ${validation.errors.join(", ")}`;
  const retryFiles = await attempt(corrective);
  const retryValidation = validateCodegenOutput(retryFiles, params.configYaml);
  if (retryValidation.valid) return retryFiles;

  throw new Error(`Code generation failed after retry: ${retryValidation.errors.join(", ")}`);
}
