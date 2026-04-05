export const dynamic = "force-dynamic";

import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { getAvailableModels } from "@/lib/sessions/validation";
import { getApiKey } from "@/lib/vault/api-keys";
import { NextResponse } from "next/server";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const anthropicKey = await getApiKey(userId, "anthropic");
  const builtInModels = getAvailableModels({ anthropic: !!anthropicKey });

  return NextResponse.json({
    builtIn: builtInModels,
    hasAnthropicKey: !!anthropicKey,
  });
}
