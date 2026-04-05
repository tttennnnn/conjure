export const dynamic = "force-dynamic";

import { createGetHandler } from "@/lib/api/handler";
import { getAvailableModels } from "@/lib/sessions/validation";
import { getApiKey } from "@/lib/vault/api-keys";
import { NextResponse } from "next/server";

export const GET = createGetHandler({}, async ({ userId }) => {
  const anthropicKey = await getApiKey(userId, "anthropic");
  const builtInModels = getAvailableModels({ anthropic: !!anthropicKey });

  return NextResponse.json({
    builtIn: builtInModels,
    hasAnthropicKey: !!anthropicKey,
  });
});
