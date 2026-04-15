import { getPrisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm/client";
import { parseLLMResponse } from "@/lib/llm/parse";
import { checkPromptGuardrails } from "@/lib/llm/guardrails";
import { buildDiagramSystemPrompt } from "@/lib/llm/prompts/diagram";
import { classifyLLMError, LLM_ERROR_RESPONSE, LLM_AUTH_ERROR_RESPONSE } from "@/lib/api/errors";
import type { ConversationMessage } from "@/lib/llm/types";
import type { ChatMessageData } from "@/lib/chat/types";
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

export interface ChatResult {
  userMessage: ChatMessageData;
  assistantMessage: ChatMessageData;
  mermaidCode: string | null;
  configYaml: string | null;
  warnings: string[];
}

function formatMessage(m: { id: string; role: string; content: string; createdAt: Date; diagramUpdated?: boolean | null; eventKind?: string | null }): ChatMessageData {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    ...(m.diagramUpdated && { diagramUpdated: true }),
    ...(m.eventKind != null && { eventKind: m.eventKind as ChatMessageData["eventKind"] }),
  };
}

export async function processMessage(params: ProcessMessageParams): Promise<ChatResult> {
  const { session, message, provider, modelId, apiKey, disableReasoning } = params;
  const prisma = getPrisma();

  // Build conversation history, filtering out error messages, event rows, and legacy synthetic edits
  const history: ConversationMessage[] = session.messages
    .filter((m) => !ERROR_MESSAGES.has(m.content) && m.eventKind == null && !(m.role === "user" && m.diagramUpdated))
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

  // --- LLM phase ---
  let rawBlocks;
  let result;
  try {
    const guardrail = await checkPromptGuardrails(message, provider, modelId, apiKey, disableReasoning);
    if (!guardrail.allowed) {
      const refusalContent = "I can only help with cloud infrastructure design. Could you describe the infrastructure you'd like to build?";
      const { userMessage, assistantMessage } = await prisma.$transaction(async (tx) => {
        const userMessage = await tx.message.create({
          data: { sessionId: session.id, role: "user", content: message },
        });
        const assistantMessage = await tx.message.create({
          data: { sessionId: session.id, role: "assistant", content: refusalContent },
        });
        return { userMessage, assistantMessage };
      });
      return {
        userMessage: formatMessage(userMessage),
        assistantMessage: formatMessage(assistantMessage),
        mermaidCode: null,
        configYaml: null,
        warnings: [],
      };
    }

    rawBlocks = await callLLM({ provider, modelId, apiKey, systemPrompt, messages: history, disableReasoning });
    result = parseLLMResponse(rawBlocks, session.mermaidCode, session.configYaml);
  } catch (err) {
    console.error("LLM call failed:", err);
    const classified = classifyLLMError(err);

    const { userMessage, errorMessage } = await prisma.$transaction(async (tx) => {
      const userMessage = await tx.message.create({
        data: { sessionId: session.id, role: "user", content: message },
      });
      const errorMessage = await tx.message.create({
        data: { sessionId: session.id, role: "assistant", content: classified.message },
      });
      return { userMessage, errorMessage };
    });

    return {
      userMessage: formatMessage(userMessage),
      assistantMessage: formatMessage(errorMessage),
      mermaidCode: null,
      configYaml: null,
      warnings: [],
    };
  }

  // --- DB persistence phase (atomic) ---
  let assistantContent = result.chatText;
  if (result.validationWarnings.length > 0) {
    assistantContent += "\n\n" + result.validationWarnings.map((w) => `⚠ ${w}`).join("\n");
  }

  const diagramChanged = !!(result.mermaid || result.configYaml);

  const { userMessage, assistantMessage } = await prisma.$transaction(async (tx) => {
    const userMessage = await tx.message.create({
      data: { sessionId: session.id, role: "user", content: message },
    });
    const assistantMessage = await tx.message.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: assistantContent,
        diagramUpdated: diagramChanged,
      },
    });

    if (diagramChanged) {
      const updateData: Record<string, unknown> = {};
      if (result.mermaid) updateData.mermaidCode = result.mermaid;
      if (result.configYaml) updateData.configYaml = result.configYaml;
      if (session.iacCode) updateData.iacStale = true;
      // Guard against concurrent requests that already wrote newer diagram state.
      // updatedAt was captured before the LLM call; if it changed, another request
      // won the race and we must not silently overwrite its changes.
      const updated = await tx.session.updateMany({
        where: { id: session.id, updatedAt: session.updatedAt },
        data: updateData,
      });
      if (updated.count === 0) {
        throw new Error("SESSION_CONCURRENT_MODIFICATION");
      }
    }

    return { userMessage, assistantMessage };
  });

  return {
    userMessage: formatMessage(userMessage),
    assistantMessage: formatMessage(assistantMessage),
    mermaidCode: result.mermaid,
    configYaml: result.configYaml,
    warnings: result.validationWarnings,
  };
}
