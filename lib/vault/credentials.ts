import { createClient } from "@supabase/supabase-js";
import { getPrisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const VALID_PROVIDERS = ["aws", "gcp"] as const;
export type CredentialProvider = (typeof VALID_PROVIDERS)[number];

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

export interface GcpCredentials {
  serviceAccountJson: string;
}

export type CredentialPayload = AwsCredentials | GcpCredentials;

export interface CredentialProfileSummary {
  id: string;
  provider: CredentialProvider;
  name: string;
  hint: string;
  defaultRegion: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Service client (server-only, uses service role key for Vault access)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9 _-]{0,48}[a-zA-Z0-9]$/;
const AWS_ACCESS_KEY_ID_PATTERN = /^(AKIA|ASIA)[A-Z0-9]{16}$/;
const AWS_SECRET_ACCESS_KEY_PATTERN = /^[A-Za-z0-9/+=]{40}$/;
const AWS_REGION_PATTERN = /^[a-z]{2}-[a-z]+-\d{1,2}$/;
const GCP_REGION_PATTERN = /^[a-z]+-[a-z]+\d{1,2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_GCP_JSON_LENGTH = 10_240; // 10 KB

const GCP_REQUIRED_FIELDS = [
  "project_id",
  "private_key_id",
  "private_key",
  "client_email",
  "client_id",
] as const;

export function isValidCredentialProvider(
  provider: string,
): provider is CredentialProvider {
  return VALID_PROVIDERS.includes(provider as CredentialProvider);
}

export function isValidUuid(id: string): boolean {
  return UUID_PATTERN.test(id);
}

export function validateCredentialName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Profile name is required";
  if (trimmed.length === 1) {
    // Single char: must be alphanumeric (the regex requires start + end chars)
    if (!/^[a-zA-Z0-9]$/.test(trimmed)) {
      return "Profile name must start and end with a letter or number";
    }
    return null;
  }
  if (trimmed.length > 50) return "Profile name must be 50 characters or fewer";
  if (!NAME_PATTERN.test(trimmed)) {
    return "Profile name must start and end with a letter or number, and contain only letters, numbers, spaces, hyphens, or underscores";
  }
  return null;
}

export function validateAwsCredentials(creds: unknown): string | null {
  if (typeof creds !== "object" || creds === null) {
    return "Credentials must be an object with accessKeyId and secretAccessKey";
  }

  const { accessKeyId, secretAccessKey } = creds as Record<string, unknown>;

  if (typeof accessKeyId !== "string" || accessKeyId.length === 0) {
    return "Access Key ID is required";
  }
  if (!AWS_ACCESS_KEY_ID_PATTERN.test(accessKeyId)) {
    return "Access Key ID must start with AKIA or ASIA and be exactly 20 alphanumeric characters";
  }

  if (typeof secretAccessKey !== "string" || secretAccessKey.length === 0) {
    return "Secret Access Key is required";
  }
  if (!AWS_SECRET_ACCESS_KEY_PATTERN.test(secretAccessKey)) {
    return "Secret Access Key must be exactly 40 characters (letters, numbers, /, +, or =)";
  }

  return null;
}

export function validateGcpCredentials(creds: unknown): string | null {
  if (typeof creds !== "object" || creds === null) {
    return "Credentials must be an object with serviceAccountJson";
  }

  const { serviceAccountJson } = creds as Record<string, unknown>;

  if (typeof serviceAccountJson !== "string" || serviceAccountJson.length === 0) {
    return "Service Account JSON is required";
  }
  if (serviceAccountJson.length > MAX_GCP_JSON_LENGTH) {
    return "Service Account JSON exceeds the 10 KB size limit";
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(serviceAccountJson);
  } catch {
    return "Service Account JSON is not valid JSON";
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return "Service Account JSON must be a JSON object";
  }

  if (parsed.type !== "service_account") {
    return 'Service Account JSON must have "type": "service_account"';
  }

  for (const field of GCP_REQUIRED_FIELDS) {
    if (typeof parsed[field] !== "string" || (parsed[field] as string).length === 0) {
      return `Service Account JSON is missing required field: ${field}`;
    }
  }

  return null;
}

export function validateCredentials(
  provider: CredentialProvider,
  creds: unknown,
): string | null {
  if (provider === "aws") return validateAwsCredentials(creds);
  return validateGcpCredentials(creds);
}

export function validateRegion(
  provider: CredentialProvider,
  region: string,
): string | null {
  if (typeof region !== "string" || region.length === 0) {
    return "Default region is required";
  }
  if (provider === "aws") {
    if (!AWS_REGION_PATTERN.test(region)) {
      return "AWS region must match format like us-east-1 or ap-southeast-1";
    }
  } else {
    if (!GCP_REGION_PATTERN.test(region)) {
      return "GCP region must match format like us-central1 or europe-west1";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Masking (credential values never leave the server — only hints)
// ---------------------------------------------------------------------------

export function maskCredentialHint(
  provider: CredentialProvider,
  vaultJson: string,
): string {
  try {
    const parsed = JSON.parse(vaultJson);
    if (provider === "aws") {
      const keyId: string = parsed.accessKeyId ?? "";
      if (keyId.length < 8) return "(unable to read)";
      return `${keyId.slice(0, 4)}...${keyId.slice(-4)}`;
    }
    // GCP
    const saJson = parsed.serviceAccountJson;
    if (typeof saJson !== "string") return "(unable to read)";
    const sa = JSON.parse(saJson);
    const projectId = sa.project_id;
    if (typeof projectId === "string" && projectId.length > 0) {
      return `project: ${projectId}`;
    }
    return "(unable to read)";
  } catch {
    return "(unable to read)";
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function serializeCredentials(
  provider: CredentialProvider,
  creds: CredentialPayload,
): string {
  if (provider === "aws") {
    const { accessKeyId, secretAccessKey } = creds as AwsCredentials;
    return JSON.stringify({ accessKeyId, secretAccessKey });
  }
  const { serviceAccountJson } = creds as GcpCredentials;
  return JSON.stringify({ serviceAccountJson });
}

// ---------------------------------------------------------------------------
// CRUD — all vault operations are server-only
// ---------------------------------------------------------------------------

export async function storeCredentialProfile(
  userId: string,
  provider: CredentialProvider,
  name: string,
  creds: CredentialPayload,
  defaultRegion: string,
): Promise<CredentialProfileSummary> {
  const serialized = serializeCredentials(provider, creds);
  const supabase = getServiceClient();

  const { data: secretId, error } = await supabase.rpc("vault_create_secret", {
    new_secret: serialized,
    new_name: `credential_${userId}_${provider}_${Date.now()}`,
  });
  if (error) throw new Error("Failed to store credentials in Vault");

  let profile;
  try {
    profile = await getPrisma().credentialProfile.create({
      data: {
        userId,
        provider,
        name: name.trim(),
        credentials: secretId as string,
        defaultRegion,
      },
    });
  } catch (prismaError) {
    // Compensating rollback: remove the orphaned Vault secret
    try {
      const { error: rollbackError } = await supabase.rpc("vault_delete_secret", {
        secret_id: secretId,
      });
      if (rollbackError) {
        console.error(
          "Failed to roll back Vault secret after Prisma failure — secret may be orphaned:",
          rollbackError,
        );
      }
    } catch (rollbackError) {
      console.error(
        "Failed to roll back Vault secret after Prisma failure — secret may be orphaned:",
        rollbackError,
      );
    }
    throw prismaError;
  }

  return {
    id: profile.id,
    provider: provider,
    name: profile.name,
    hint: maskCredentialHint(provider, serialized),
    defaultRegion: profile.defaultRegion,
    createdAt: profile.createdAt.toISOString(),
  };
}

export async function updateCredentialProfile(
  userId: string,
  profileId: string,
  updates: {
    name?: string;
    credentials?: CredentialPayload;
    defaultRegion?: string;
  },
): Promise<CredentialProfileSummary> {
  const profile = await getPrisma().credentialProfile.findUnique({
    where: { id: profileId },
  });
  if (!profile || profile.userId !== userId) {
    throw new Error("Credential profile not found");
  }

  const provider = profile.provider as CredentialProvider;

  // Update vault secret if new credentials provided
  if (updates.credentials) {
    const serialized = serializeCredentials(provider, updates.credentials);
    const supabase = getServiceClient();
    const { error } = await supabase.rpc("vault_update_secret", {
      secret_id: profile.credentials,
      new_secret: serialized,
    });
    if (error) throw new Error("Failed to update credentials in Vault");
  }

  let updated;
  try {
    updated = await getPrisma().credentialProfile.update({
      where: { id: profileId },
      data: {
        ...(updates.name !== undefined && { name: updates.name.trim() }),
        ...(updates.defaultRegion !== undefined && {
          defaultRegion: updates.defaultRegion,
        }),
      },
    });
  } catch (prismaError) {
    console.error(
      "Prisma update failed after Vault update succeeded. Vault secret is current but DB metadata may be stale:",
      prismaError,
    );
    throw prismaError;
  }

  // Read back from vault to generate the current hint
  const supabase = getServiceClient();
  const { data: secret, error: readError } = await supabase.rpc(
    "vault_read_secret",
    { secret_id: updated.credentials },
  );
  const hint =
    readError || !secret
      ? "(unable to read)"
      : maskCredentialHint(provider, secret as string);

  return {
    id: updated.id,
    provider,
    name: updated.name,
    hint,
    defaultRegion: updated.defaultRegion,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function deleteCredentialProfile(
  userId: string,
  profileId: string,
): Promise<boolean> {
  const profile = await getPrisma().credentialProfile.findUnique({
    where: { id: profileId },
  });
  if (!profile || profile.userId !== userId) return false;

  const supabase = getServiceClient();
  const { error: vaultError } = await supabase.rpc("vault_delete_secret", {
    secret_id: profile.credentials,
  });
  if (vaultError) {
    console.error("Failed to delete Vault secret:", vaultError);
    throw new Error("Failed to delete credentials from Vault");
  }

  try {
    await getPrisma().credentialProfile.delete({ where: { id: profileId } });
  } catch (prismaError) {
    console.error(
      "Vault secret deleted but DB row delete failed — profile row may be stuck with a dead secret reference:",
      prismaError,
    );
    throw prismaError;
  }

  return true;
}

export async function listCredentialProfiles(
  userId: string,
): Promise<CredentialProfileSummary[]> {
  const profiles = await getPrisma().credentialProfile.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const supabase = getServiceClient();
  const summaries: CredentialProfileSummary[] = [];

  for (const profile of profiles) {
    const provider = profile.provider as CredentialProvider;
    if (!isValidCredentialProvider(provider)) continue;

    let hint = "(unable to read)";
    try {
      const { data: secret, error } = await supabase.rpc("vault_read_secret", {
        secret_id: profile.credentials,
      });
      if (!error && secret) {
        hint = maskCredentialHint(provider, secret as string);
      }
    } catch {
      // Vault read failed — show fallback hint, don't break the list
    }

    summaries.push({
      id: profile.id,
      provider,
      name: profile.name,
      hint,
      defaultRegion: profile.defaultRegion,
      createdAt: profile.createdAt.toISOString(),
    });
  }

  return summaries;
}

/**
 * Returns the actual decrypted credentials for a profile.
 * Used ONLY by deploy routes (terraform plan/apply) — never by the settings API.
 */
export async function readCredentialProfile(
  userId: string,
  profileId: string,
): Promise<{ provider: CredentialProvider; credentials: CredentialPayload } | null> {
  const profile = await getPrisma().credentialProfile.findUnique({
    where: { id: profileId },
  });
  if (!profile || profile.userId !== userId) return null;

  const provider = profile.provider as CredentialProvider;
  if (!isValidCredentialProvider(provider)) return null;

  const supabase = getServiceClient();
  const { data: secret, error } = await supabase.rpc("vault_read_secret", {
    secret_id: profile.credentials,
  });
  if (error || !secret) throw new Error("Failed to read credentials from Vault");

  const parsed = JSON.parse(secret as string) as CredentialPayload;
  return { provider, credentials: parsed };
}
