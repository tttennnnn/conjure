export const dynamic = "force-dynamic";

import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { getPrisma } from "@/lib/prisma";
import { getAvailableModels } from "@/lib/sessions/validation";
import { getApiKey } from "@/lib/vault/api-keys";
import { NextResponse } from "next/server";

const MAX_MODEL_ID_LENGTH = 200;
const MAX_DISPLAY_NAME_LENGTH = 100;

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [openRouterKey, anthropicKey] = await Promise.all([
    getApiKey(userId, "openrouter"),
    getApiKey(userId, "anthropic"),
  ]);

  const builtInModels = getAvailableModels(!!openRouterKey, !!anthropicKey);

  const customModels = await getPrisma().userCustomModel.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    builtIn: builtInModels,
    custom: customModels,
    hasOpenRouterKey: !!openRouterKey,
    hasAnthropicKey: !!anthropicKey,
  });
}

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { openRouterModelId?: string; displayName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { openRouterModelId, displayName } = body;

  if (!openRouterModelId?.trim() || !displayName?.trim()) {
    return NextResponse.json(
      { error: "openRouterModelId and displayName are required" },
      { status: 400 },
    );
  }

  if (openRouterModelId.length > MAX_MODEL_ID_LENGTH) {
    return NextResponse.json(
      { error: `Model ID must be ${MAX_MODEL_ID_LENGTH} characters or less` },
      { status: 400 },
    );
  }

  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return NextResponse.json(
      { error: `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or less` },
      { status: 400 },
    );
  }

  // Require user to have their own OpenRouter key for custom models
  const openRouterKey = await getApiKey(userId, "openrouter");
  if (!openRouterKey) {
    return NextResponse.json(
      { error: "OpenRouter API key required to add custom models" },
      { status: 400 },
    );
  }

  try {
    const model = await getPrisma().userCustomModel.upsert({
      where: {
        userId_openRouterModelId: { userId, openRouterModelId: openRouterModelId.trim() },
      },
      update: { displayName: displayName.trim() },
      create: {
        userId,
        openRouterModelId: openRouterModelId.trim(),
        displayName: displayName.trim(),
      },
    });

    return NextResponse.json(model, { status: 201 });
  } catch (err) {
    console.error("Failed to save custom model:", err);
    return NextResponse.json(
      { error: "Failed to save custom model" },
      { status: 500 },
    );
  }
}
