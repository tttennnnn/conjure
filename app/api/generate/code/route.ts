export const dynamic = "force-dynamic";

import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { getPrisma } from "@/lib/prisma";
import { resolveModelId } from "@/lib/sessions/validation";
import { getApiKey } from "@/lib/vault/api-keys";
import { generateCode } from "@/lib/llm/codegen";
import { createRateLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

// Code generation is expensive — limit more conservatively than chat
const codeLimiter = createRateLimiter("generate-code", { maxRequests: 5, windowMs: 60_000 });

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = codeLimiter(userId);
  if (!limit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId } = body;
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const session = await getPrisma().session.findUnique({ where: { id: sessionId } });

  if (!session || session.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.mermaidCode?.trim() || !session.configYaml?.trim()) {
    return NextResponse.json(
      { error: "Session has no diagram or config to generate code from" },
      { status: 400 },
    );
  }

  const resolved = resolveModelId(session.model);
  if (!resolved) {
    return NextResponse.json({ error: "Invalid model configuration" }, { status: 400 });
  }

  // Resolve API key (same logic as /api/chat)
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
    apiKey = await getApiKey(userId, "openrouter");
    if (!apiKey) {
      apiKey = process.env.OPENROUTER_API_KEY ?? null;
    }
    if (!apiKey) {
      return NextResponse.json({ error: "No OpenRouter API key configured" }, { status: 500 });
    }
  }

  try {
    const files = await generateCode({
      mermaidCode: session.mermaidCode,
      configYaml: session.configYaml,
      targetEnv: session.targetEnv,
      iacTool: session.iacTool,
      provider: resolved.provider,
      modelId: resolved.modelId,
      apiKey,
    });

    // Persist generated code and clear stale flag
    await getPrisma().session.update({
      where: { id: sessionId },
      data: {
        // Prisma Json type requires a plain object — cast to satisfy the index signature
        iacCode: files as unknown as Record<string, string>,
        iacStale: false,
      },
    });

    return NextResponse.json(files);
  } catch (err) {
    console.error("Code generation failed:", err);
    return NextResponse.json(
      { error: "Code generation failed. Please try again." },
      { status: 500 },
    );
  }
}
