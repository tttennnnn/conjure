import { getApiKey } from "@/lib/vault/api-keys";

/**
 * Resolve the API key for an LLM provider.
 * Returns the key on success, or a structured error for the route to forward.
 */
export async function resolveApiKey(
  userId: string,
  provider: "openrouter" | "anthropic",
): Promise<{ apiKey: string } | { error: string; status: number }> {
  if (provider === "anthropic") {
    const key = await getApiKey(userId, "anthropic");
    if (!key) {
      return { error: "Anthropic API key required. Add one in Settings > API Keys.", status: 400 };
    }
    return { apiKey: key };
  }

  const key = process.env.OPENROUTER_API_KEY ?? null;
  if (!key) {
    return { error: "No OpenRouter API key configured", status: 500 };
  }
  return { apiKey: key };
}
