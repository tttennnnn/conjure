export const dynamic = "force-dynamic";

import { createHandler, createGetHandler, createDeleteHandler } from "@/lib/api/handler";
import {
  deleteApiKey,
  getApiKey,
  isValidProvider,
  listApiKeys,
  maskKey,
  storeApiKey,
  validateKeyFormat,
} from "@/lib/vault/api-keys";
import { createRateLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const apiKeysLimiter = createRateLimiter("api-keys", { maxRequests: 5, windowMs: 60_000 });

export const GET = createGetHandler({}, async ({ userId }) => {
  const keys = await listApiKeys(userId);

  const result = [];
  for (const entry of keys) {
    if (!isValidProvider(entry.provider)) continue;
    const key = await getApiKey(userId, entry.provider);
    result.push({
      provider: entry.provider,
      key_hint: key ? maskKey(key) : null,
      created_at: entry.createdAt.toISOString(),
    });
  }

  return NextResponse.json(result);
});

export const POST = createHandler<{ provider?: string; key?: string }>(
  { rateLimit: apiKeysLimiter },
  async ({ userId, body }) => {
    const { provider, key } = body;

    if (!provider || !key) {
      return NextResponse.json(
        { error: "provider and key are required" },
        { status: 400 },
      );
    }

    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: 'provider must be "anthropic"' },
        { status: 400 },
      );
    }

    const formatError = validateKeyFormat(provider, key);
    if (formatError) {
      return NextResponse.json({ error: formatError }, { status: 400 });
    }

    try {
      await storeApiKey(userId, provider, key);
    } catch (err) {
      console.error("Failed to store API key:", err);
      return NextResponse.json(
        { error: "Failed to store API key" },
        { status: 500 },
      );
    }

    return NextResponse.json({ provider, key_hint: maskKey(key) });
  },
);

export const DELETE = createDeleteHandler(
  { rateLimit: apiKeysLimiter },
  async ({ userId, request }) => {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");

    if (!provider || !isValidProvider(provider)) {
      return NextResponse.json(
        { error: 'provider query param must be "anthropic"' },
        { status: 400 },
      );
    }

    try {
      const deleted = await deleteApiKey(userId, provider);
      if (!deleted) {
        return NextResponse.json(
          { error: "No key found for this provider" },
          { status: 404 },
        );
      }
    } catch (err) {
      console.error("Failed to delete API key:", err);
      return NextResponse.json(
        { error: "Failed to delete API key" },
        { status: 500 },
      );
    }

    return NextResponse.json({ deleted: true });
  },
);
