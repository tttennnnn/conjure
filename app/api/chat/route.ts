export const dynamic = "force-dynamic";

import { createHandler } from "@/lib/api/handler";
import { getPrisma } from "@/lib/prisma";
import { resolveModelId } from "@/lib/sessions/validation";
import { resolveApiKey } from "@/lib/api/resolve-key";
import { processMessage } from "@/lib/chat/process-message";
import { createRateLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const chatLimiter = createRateLimiter("chat", { maxRequests: 10, windowMs: 60_000 });
const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 20;

export const POST = createHandler<{ sessionId?: string; message?: string }>(
  { rateLimit: chatLimiter },
  async ({ userId, body }) => {
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

    const session = await getPrisma().session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          where: { eventKind: null },
          orderBy: { createdAt: "desc" },
          take: MAX_HISTORY_MESSAGES,
        },
      },
    });

    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetched newest N messages desc — reverse to chronological for LLM context
    session.messages.reverse();

    const resolved = resolveModelId(session.model);
    if (!resolved) {
      return NextResponse.json({ error: "Invalid model configuration" }, { status: 400 });
    }

    const keyResult = await resolveApiKey(userId, resolved.provider);
    if ("error" in keyResult) {
      return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
    }

    let result;
    try {
      result = await processMessage({
        session,
        message: message.trim(),
        provider: resolved.provider,
        modelId: resolved.modelId,
        apiKey: keyResult.apiKey,
        disableReasoning: resolved.disableReasoning,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "SESSION_CONCURRENT_MODIFICATION") {
        return NextResponse.json(
          { error: "Session was updated by another request. Please retry." },
          { status: 409 },
        );
      }
      throw err;
    }

    return NextResponse.json(result);
  },
);
