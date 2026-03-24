import { createClient } from "@supabase/supabase-js";
import { getPrisma } from "@/lib/prisma";

const VALID_PROVIDERS = ["openrouter", "anthropic"] as const;
type Provider = (typeof VALID_PROVIDERS)[number];

const KEY_PREFIXES: Record<Provider, string> = {
  openrouter: "sk-or-",
  anthropic: "sk-ant-",
};

const MIN_KEY_LENGTH = 16;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export function isValidProvider(provider: string): provider is Provider {
  return VALID_PROVIDERS.includes(provider as Provider);
}

export function validateKeyFormat(provider: Provider, key: string): string | null {
  if (key.length < MIN_KEY_LENGTH) {
    return `Key must be at least ${MIN_KEY_LENGTH} characters`;
  }
  const prefix = KEY_PREFIXES[provider];
  if (!key.startsWith(prefix)) {
    return `${provider} keys must start with "${prefix}"`;
  }
  return null;
}

export function maskKey(key: string): string {
  if (key.length < MIN_KEY_LENGTH) return "****";
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export async function storeApiKey(
  userId: string,
  provider: Provider,
  key: string,
): Promise<void> {
  const supabase = getServiceClient();

  // Check if user already has a key for this provider
  const existing = await getPrisma().userApiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  });

  if (existing) {
    // Update existing Vault secret
    const { error } = await supabase.rpc("vault_update_secret", {
      secret_id: existing.encryptedKey,
      new_secret: key,
    });
    if (error) throw new Error(`Failed to update secret in Vault: ${error.message}`);

    await getPrisma().userApiKey.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
  } else {
    // Create new Vault secret
    const { data, error } = await supabase.rpc("vault_create_secret", {
      new_secret: key,
      new_name: `api_key_${userId}_${provider}`,
    });
    if (error) throw new Error(`Failed to store secret in Vault: ${error.message}`);

    await getPrisma().userApiKey.create({
      data: {
        userId,
        provider,
        encryptedKey: data as string,
      },
    });
  }
}

export async function getApiKey(
  userId: string,
  provider: Provider,
): Promise<string | null> {
  const existing = await getPrisma().userApiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  });

  if (!existing) return null;

  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("vault_read_secret", {
    secret_id: existing.encryptedKey,
  });

  if (error) throw new Error(`Failed to read secret from Vault: ${error.message}`);
  return data as string;
}

export async function deleteApiKey(
  userId: string,
  provider: Provider,
): Promise<boolean> {
  const existing = await getPrisma().userApiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  });

  if (!existing) return false;

  const supabase = getServiceClient();
  await supabase.rpc("vault_delete_secret", {
    secret_id: existing.encryptedKey,
  });

  await getPrisma().userApiKey.delete({ where: { id: existing.id } });
  return true;
}

export async function listApiKeys(userId: string) {
  return getPrisma().userApiKey.findMany({
    where: { userId },
    select: { provider: true, createdAt: true },
  });
}
