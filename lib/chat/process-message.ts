import { getPrisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm/client";
import { parseLLMResponse } from "@/lib/llm/parse";
import { checkPromptGuardrails } from "@/lib/llm/guardrails";
import { buildDiagramSystemPrompt } from "@/lib/llm/prompts/diagram";
import { classifyLLMError, LLM_ERROR_RESPONSE, LLM_AUTH_ERROR_RESPONSE } from "@/lib/api/errors";
import type { ConversationMessage } from "@/lib/llm/types";
import type { Message, Session } from "@prisma/client";

const MAX_HISTORY_MESSAGES = 20;
const ERROR_MESSAGES = new Set([LLM_ERROR_RESPONSE, LLM_AUTH_ERROR_RESPONSE]);

interface ProcessMessageParams {
  session: Session & { messages: Message[] };
  message: string;
  provider: "openrouter" | "anthropic";
  modelId: string;
  apiKey: string;
  disableReasoning: boolean;
}

interface MessageData {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  diagramUpdated?: boolean;
}

export interface ChatResult {
  userMessage: MessageData;
  assistantMessage: MessageData;
  mermaidCode: string | null;
  configYaml: string | null;
  warnings: string[];
}

function formatMessage(m: { id: string; role: string; content: string; createdAt: Date; diagramUpdated?: boolean | null }): MessageData {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    ...(m.diagramUpdated != null && { diagramUpdated: m.diagramUpdated }),
  };
}

export async function processMessage(params: ProcessMessageParams): Promise<ChatResult> {
  const { session, message, provider, modelId, apiKey, disableReasoning } = params;

  // Save user message
  const userMessage = await getPrisma().message.create({
    data: { sessionId: session.id, role: "user", content: message },
  });

  // Build conversation history, filtering out error messages
  const history: ConversationMessage[] = session.messages
    .filter((m) => !ERROR_MESSAGES.has(m.content))
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  history.push({ role: "user", content: message });

  const systemPrompt = buildDiagramSystemPrompt(
    session.mermaidCode,
    session.configYaml,
    session.targetEnv,
    session.iacTool,
    provider,
  );

  try {
    // Pre-filter: check if prompt is infrastructure-related
    const guardrail = await checkPromptGuardrails(message, provider, modelId, apiKey, disableReasoning);
    if (!guardrail.allowed) {
      const refusalContent = "I can only help with cloud infrastructure design. Could you describe the infrastructure you'd like to build?";
      const refusalMessage = await getPrisma().message.create({
        data: { sessionId: session.id, role: "assistant", content: refusalContent },
      });
      return {
        userMessage: formatMessage(userMessage),
        assistantMessage: formatMessage(refusalMessage),
        mermaidCode: null,
        configYaml: null,
        warnings: [],
      };
    }

    // Call LLM
    const rawBlocks = await callLLM({ provider, modelId, apiKey, systemPrompt, messages: history, disableReasoning });
    const result = parseLLMResponse(rawBlocks, session.mermaidCode, session.configYaml);

    // Build assistant message content (include warnings if any)
    let assistantContent = result.chatText;
    if (result.validationWarnings.length > 0) {
      assistantContent += "\n\n" + result.validationWarnings.map((w) => `⚠ ${w}`).join("\n");
    }

    const assistantMessage = await getPrisma().message.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: assistantContent,
        diagramUpdated: !!(result.mermaid || result.configYaml),
      },
    });

    // Update session if diagram/config changed
    if (result.mermaid || result.configYaml) {
      const updateData: Record<string, unknown> = {};
      if (result.mermaid) updateData.mermaidCode = result.mermaid;
      if (result.configYaml) updateData.configYaml = result.configYaml;
      if (session.iacCode) updateData.iacStale = true;
      await getPrisma().session.update({ where: { id: session.id }, data: updateData });
    }

    return {
      userMessage: formatMessage(userMessage),
      assistantMessage: formatMessage(assistantMessage),
      mermaidCode: result.mermaid,
      configYaml: result.configYaml,
      warnings: result.validationWarnings,
    };
  } catch (err) {
    console.error("LLM call failed:", err);
    const classified = classifyLLMError(err);

    const errorMessage = await getPrisma().message.create({
      data: { sessionId: session.id, role: "assistant", content: classified.message },
    });

    return {
      userMessage: formatMessage(userMessage),
      assistantMessage: formatMessage(errorMessage),
      mermaidCode: null,
      configYaml: null,
      warnings: [],
    };
  }
}
