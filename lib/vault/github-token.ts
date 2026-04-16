import { createClient } from "@supabase/supabase-js";
import { getPrisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _serviceClient: any = null;
function getServiceClient() {
  if (!_serviceClient) {
    _serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _serviceClient;
}

const PROVIDER = "github";

export async function storeGitHubToken(userId: string, token: string): Promise<void> {
  const supabase = getServiceClient();

  const existing = await getPrisma().userApiKey.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER } },
  });

  if (existing) {
    const { error } = await supabase.rpc("vault_update_secret", {
      secret_id: existing.encryptedKey,
      new_secret: token,
    });
    if (error) throw new Error(`Failed to update GitHub token in Vault: ${error.message}`);

    await getPrisma().userApiKey.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });
  } else {
    const { data, error } = await supabase.rpc("vault_create_secret", {
      new_secret: token,
      new_name: `github_token_${userId}`,
    });
    if (error) throw new Error(`Failed to store GitHub token in Vault: ${error.message}`);

    try {
      await getPrisma().userApiKey.create({
        data: {
          userId,
          provider: PROVIDER,
          encryptedKey: data as string,
        },
      });
    } catch (prismaError) {
      try {
        await supabase.rpc("vault_delete_secret", { secret_id: data });
      } catch {
        // Orphaned secret — logged but not fatal
      }
      throw prismaError;
    }
  }
}

export async function getGitHubToken(userId: string): Promise<string | null> {
  const existing = await getPrisma().userApiKey.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER } },
  });

  if (!existing) return null;

  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("vault_read_secret", {
    secret_id: existing.encryptedKey,
  });

  if (error || !data) return null;
  return data as string;
}

export async function deleteGitHubToken(userId: string): Promise<void> {
  const existing = await getPrisma().userApiKey.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER } },
  });

  if (!existing) return;

  const supabase = getServiceClient();
  await supabase.rpc("vault_delete_secret", { secret_id: existing.encryptedKey });
  await getPrisma().userApiKey.delete({ where: { id: existing.id } });
}
