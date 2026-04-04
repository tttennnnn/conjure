export const dynamic = "force-dynamic";

import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { getPrisma } from "@/lib/prisma";
import { resolveModelId } from "@/lib/sessions/validation";
import { getApiKey } from "@/lib/vault/api-keys";
import { callLLM } from "@/lib/llm/client";
import { parseLLMResponse } from "@/lib/llm/parse";
import { checkPromptGuardrails } from "@/lib/llm/guardrails";
import { buildDiagramSystemPrompt } from "@/lib/llm/prompts/diagram";
import { createRateLimiter } from "@/lib/rate-limit";
import type { ConversationMessage } from "@/lib/llm/types";
import { NextResponse } from "next/server";

const chatLimiter = createRateLimiter("chat", { maxRequests: 10, windowMs: 60_000 });

const MAX_HISTORY_MESSAGES = 20;
const LLM_ERROR_RESPONSE = "Sorry, I encountered an error processing your request. Please try again.";
const LLM_AUTH_ERROR_RESPONSE = "Your API key is invalid or has been revoked. Please update it in Settings > API Keys.";

function getErrorStatus(err: unknown): number | null {
  if (typeof err === "object" && err !== null && "status" in err) {
    return (err as { status: number }).status;
  }
  return null;
}

function isAuthError(err: unknown): boolean {
  return getErrorStatus(err) === 401;
}

function isRateLimitError(err: unknown): boolean {
  return getErrorStatus(err) === 429;
}

function isModelUnavailableError(err: unknown): boolean {
  const status = getErrorStatus(err);
  return status === 502 || status === 503;
}

const MAX_MESSAGE_LENGTH = 1000;

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = chatLimiter(userId);
  if (!limit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { sessionId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, message } = body;
  if (!sessionId || !message?.trim()) {
    return NextResponse.json(
      { error: "sessionId and message are required" },
      { status: 400 },
    );
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` },
      { status: 400 },
    );
  }

  // Fetch session + verify ownership
  const session = await getPrisma().session.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: MAX_HISTORY_MESSAGES,
      },
    },
  });

  if (!session || session.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Fetched newest N messages desc -- reverse to chronological for LLM context
  session.messages.reverse();

  // Resolve model → provider-specific ID
  const resolved = resolveModelId(session.model);
  if (!resolved) {
    return NextResponse.json({ error: "Invalid model configuration" }, { status: 400 });
  }

  // Resolve API key
  let apiKey: string | null = null;
  if (resolved.provider === "anthropic") {
    apiKey = await getApiKey(userId, "anthropic");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic API key required. Add one in Settings > API Keys." },
        { status: 400 },
      );
    }
  } else {
    // Try user's OpenRouter key, fall back to app key
    apiKey = await getApiKey(userId, "openrouter");
    if (!apiKey) {
      apiKey = process.env.OPENROUTER_API_KEY ?? null;
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: "No OpenRouter API key configured" },
        { status: 500 },
      );
    }
  }

  // Save user message
  const userMessage = await getPrisma().message.create({
    data: {
      sessionId,
      role: "user",
      content: message.trim(),
    },
  });

  // Build conversation history, filtering out error messages
  const ERROR_MESSAGES = new Set([LLM_ERROR_RESPONSE, LLM_AUTH_ERROR_RESPONSE]);
  const history: ConversationMessage[] = session.messages
    .filter((m) => !ERROR_MESSAGES.has(m.content))
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  history.push({ role: "user", content: message.trim() });

  // Build system prompt
  const systemPrompt = buildDiagramSystemPrompt(
    session.mermaidCode,
    session.configYaml,
    session.targetEnv,
    session.iacTool,
    resolved.provider,
  );

  try {
    // Pre-filter: check if prompt is infrastructure-related
    const guardrail = await checkPromptGuardrails(
      message.trim(),
      resolved.provider,
      resolved.modelId,
      apiKey,
    );
    if (!guardrail.allowed) {
      const refusalContent = "I can only help with cloud infrastructure design. Could you describe the infrastructure you'd like to build?";
      const refusalMessage = await getPrisma().message.create({
        data: { sessionId, role: "assistant", content: refusalContent },
      });
      return NextResponse.json({
        userMessage: {
          id: userMessage.id,
          role: userMessage.role,
          content: userMessage.content,
          createdAt: userMessage.createdAt.toISOString(),
        },
        assistantMessage: {
          id: refusalMessage.id,
          role: refusalMessage.role,
          content: refusalMessage.content,
          createdAt: refusalMessage.createdAt.toISOString(),
        },
        mermaidCode: null,
        configYaml: null,
        warnings: [],
      });
    }

    // Call LLM
    const rawBlocks = await callLLM({
      provider: resolved.provider,
      modelId: resolved.modelId,
      apiKey,
      systemPrompt,
      messages: history,
    });

    // Validate and reconcile
    const result = parseLLMResponse(rawBlocks, session.mermaidCode, session.configYaml);

    // Build assistant message content (include warnings if any)
    let assistantContent = result.chatText;
    if (result.validationWarnings.length > 0) {
      assistantContent += "\n\n" + result.validationWarnings.map((w) => `⚠ ${w}`).join("\n");
    }

    // Save assistant message
    const assistantMessage = await getPrisma().message.create({
      data: {
        sessionId,
        role: "assistant",
        content: assistantContent,
      },
    });

    // Update session if diagram/config changed
    const updateData: Record<string, unknown> = {};
    if (result.mermaid) updateData.mermaidCode = result.mermaid;
    if (result.configYaml) updateData.configYaml = result.configYaml;

    if (result.mermaid || result.configYaml) {
      // Mark terraform code as stale if it exists
      if (session.iacCode) {
        updateData.iacStale = true;
      }
      await getPrisma().session.update({
        where: { id: sessionId },
        data: updateData,
      });
    }

    return NextResponse.json({
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt.toISOString(),
      },
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        createdAt: assistantMessage.createdAt.toISOString(),
      },
      mermaidCode: result.mermaid,
      configYaml: result.configYaml,
      warnings: result.validationWarnings,
    });
  } catch (err) {
    console.error("LLM call failed:", err);

    const errorContent = isAuthError(err)
      ? LLM_AUTH_ERROR_RESPONSE
      : isRateLimitError(err)
        ? "The model is currently rate limited. Please wait a moment and try again."
        : isModelUnavailableError(err)
          ? "The model is temporarily unavailable. Please try again shortly."
          : LLM_ERROR_RESPONSE;

    // Save an error message so the user sees feedback
    const errorMessage = await getPrisma().message.create({
      data: {
        sessionId,
        role: "assistant",
        content: errorContent,
      },
    });

    return NextResponse.json({
      userMessage: {
        id: userMessage.id,
        role: userMessage.role,
        content: userMessage.content,
        createdAt: userMessage.createdAt.toISOString(),
      },
      assistantMessage: {
        id: errorMessage.id,
        role: errorMessage.role,
        content: errorMessage.content,
        createdAt: errorMessage.createdAt.toISOString(),
      },
      mermaidCode: null,
      configYaml: null,
      warnings: [],
    });
  }
}
