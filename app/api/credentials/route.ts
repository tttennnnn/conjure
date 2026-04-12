export const dynamic = "force-dynamic";

import { createHandler, createGetHandler, createDeleteHandler } from "@/lib/api/handler";
import {
  isValidCredentialProvider,
  isValidUuid,
  validateCredentialName,
  validateCredentials,
  validateRegion,
  storeCredentialProfile,
  updateCredentialProfile,
  deleteCredentialProfile,
  listCredentialProfiles,
} from "@/lib/vault/credentials";
import { createRateLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const credentialsLimiter = createRateLimiter("credentials", {
  maxRequests: 10,
  windowMs: 60_000,
});

// ---------------------------------------------------------------------------
// GET — list all profiles (masked hints only)
// ---------------------------------------------------------------------------

export const GET = createGetHandler(
  { rateLimit: credentialsLimiter },
  async ({ userId }) => {
    try {
      const profiles = await listCredentialProfiles(userId);
      return NextResponse.json(profiles);
    } catch (err) {
      console.error("Failed to list credential profiles:", err);
      return NextResponse.json(
        { error: "Failed to list credential profiles" },
        { status: 500 },
      );
    }
  },
);

// ---------------------------------------------------------------------------
// POST — create a new credential profile
// ---------------------------------------------------------------------------

interface PostBody {
  provider?: string;
  name?: string;
  credentials?: unknown;
  defaultRegion?: string;
}

export const POST = createHandler<PostBody>(
  { rateLimit: credentialsLimiter },
  async ({ userId, body }) => {
    const { provider, name, credentials, defaultRegion } = body;

    if (!provider || typeof provider !== "string") {
      return NextResponse.json(
        { error: "provider is required" },
        { status: 400 },
      );
    }
    if (!isValidCredentialProvider(provider)) {
      return NextResponse.json(
        { error: 'provider must be "aws" or "gcp"' },
        { status: 400 },
      );
    }

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      );
    }
    const nameError = validateCredentialName(name);
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }

    if (!credentials || typeof credentials !== "object") {
      return NextResponse.json(
        { error: "credentials are required" },
        { status: 400 },
      );
    }
    const credsError = validateCredentials(provider, credentials);
    if (credsError) {
      return NextResponse.json({ error: credsError }, { status: 400 });
    }

    if (!defaultRegion || typeof defaultRegion !== "string") {
      return NextResponse.json(
        { error: "defaultRegion is required" },
        { status: 400 },
      );
    }
    const regionError = validateRegion(provider, defaultRegion);
    if (regionError) {
      return NextResponse.json({ error: regionError }, { status: 400 });
    }

    try {
      const summary = await storeCredentialProfile(
        userId,
        provider,
        name,
        credentials as Parameters<typeof storeCredentialProfile>[3],
        defaultRegion,
      );
      return NextResponse.json(summary, { status: 201 });
    } catch (err) {
      console.error("Failed to store credential profile:", err);
      return NextResponse.json(
        { error: "Failed to store credential profile" },
        { status: 500 },
      );
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH — update an existing credential profile
// ---------------------------------------------------------------------------

interface PatchBody {
  id?: string;
  name?: string;
  credentials?: unknown;
  defaultRegion?: string;
}

export const PATCH = createHandler<PatchBody>(
  { rateLimit: credentialsLimiter },
  async ({ userId, body }) => {
    const { id, name, credentials, defaultRegion } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 },
      );
    }
    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: "id must be a valid UUID" },
        { status: 400 },
      );
    }

    const hasUpdate =
      name !== undefined || credentials !== undefined || defaultRegion !== undefined;
    if (!hasUpdate) {
      return NextResponse.json(
        { error: "At least one field to update is required (name, credentials, or defaultRegion)" },
        { status: 400 },
      );
    }

    // Validate individual fields when provided
    if (name !== undefined) {
      if (typeof name !== "string") {
        return NextResponse.json(
          { error: "name must be a string" },
          { status: 400 },
        );
      }
      const nameError = validateCredentialName(name);
      if (nameError) {
        return NextResponse.json({ error: nameError }, { status: 400 });
      }
    }

    // For credentials and region validation we need the provider, which
    // comes from the existing profile. The vault helper fetches it internally
    // and will throw "not found" if the profile doesn't exist. We do a
    // lightweight pre-check here so we can validate before hitting the vault.
    if (credentials !== undefined || defaultRegion !== undefined) {
      const { getPrisma } = await import("@/lib/prisma");
      const profile = await getPrisma().credentialProfile.findUnique({
        where: { id },
        select: { provider: true, userId: true },
      });
      if (!profile || profile.userId !== userId) {
        return NextResponse.json(
          { error: "Credential profile not found" },
          { status: 404 },
        );
      }
      if (!isValidCredentialProvider(profile.provider)) {
        return NextResponse.json(
          { error: "Credential profile has an invalid provider" },
          { status: 500 },
        );
      }

      if (credentials !== undefined) {
        if (typeof credentials !== "object" || credentials === null) {
          return NextResponse.json(
            { error: "credentials must be an object" },
            { status: 400 },
          );
        }
        const credsError = validateCredentials(profile.provider, credentials);
        if (credsError) {
          return NextResponse.json({ error: credsError }, { status: 400 });
        }
      }

      if (defaultRegion !== undefined) {
        if (typeof defaultRegion !== "string") {
          return NextResponse.json(
            { error: "defaultRegion must be a string" },
            { status: 400 },
          );
        }
        const regionError = validateRegion(profile.provider, defaultRegion);
        if (regionError) {
          return NextResponse.json({ error: regionError }, { status: 400 });
        }
      }
    }

    try {
      const summary = await updateCredentialProfile(userId, id, {
        name,
        credentials: credentials as Parameters<typeof updateCredentialProfile>[2]["credentials"],
        defaultRegion,
      });
      return NextResponse.json(summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "Credential profile not found") {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      console.error("Failed to update credential profile:", err);
      return NextResponse.json(
        { error: "Failed to update credential profile" },
        { status: 500 },
      );
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE — remove a credential profile
// ---------------------------------------------------------------------------

export const DELETE = createDeleteHandler(
  { rateLimit: credentialsLimiter },
  async ({ userId, request }) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 },
      );
    }
    if (!isValidUuid(id)) {
      return NextResponse.json(
        { error: "id must be a valid UUID" },
        { status: 400 },
      );
    }

    try {
      const deleted = await deleteCredentialProfile(userId, id);
      if (!deleted) {
        return NextResponse.json(
          { error: "Credential profile not found" },
          { status: 404 },
        );
      }
    } catch (err) {
      console.error("Failed to delete credential profile:", err);
      return NextResponse.json(
        { error: "Failed to delete credential profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({ deleted: true });
  },
);
