export const dynamic = "force-dynamic";

import { createHandler } from "@/lib/api/handler";
import { getPrisma } from "@/lib/prisma";
import { resolveModelId } from "@/lib/sessions/validation";
import { resolveApiKey } from "@/lib/api/resolve-key";
import { classifyLLMError } from "@/lib/api/errors";
import { generateCode } from "@/lib/llm/codegen";
import { createRateLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

// Code generation is expensive — limit more conservatively than chat
const codeLimiter = createRateLimiter("generate-code", { maxRequests: 5, windowMs: 60_000 });

export const POST = createHandler<{ sessionId?: string }>(
  { rateLimit: codeLimiter },
  async ({ userId, body }) => {
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

    const keyResult = await resolveApiKey(userId, resolved.provider);
    if ("error" in keyResult) {
      return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
    }

    try {
      const files = await generateCode({
        mermaidCode: session.mermaidCode,
        configYaml: session.configYaml,
        targetEnv: session.targetEnv,
        iacTool: session.iacTool,
        provider: resolved.provider,
        modelId: resolved.modelId,
        apiKey: keyResult.apiKey,
        disableReasoning: resolved.disableReasoning,
      });

      await getPrisma().session.update({
        where: { id: sessionId },
        data: {
          iacCode: files as unknown as Record<string, string>,
          iacStale: false,
          // New code invalidates any prior plan — apply must not run against a different code version
          lastPlanStatus: null,
          lastApplyStatus: null,
        },
      });

      return NextResponse.json(files);
    } catch (err) {
      console.error("Code generation failed:", err);
      const classified = classifyLLMError(err);
      return NextResponse.json(
        { error: classified.message },
        { status: classified.status },
      );
    }
  },
);
