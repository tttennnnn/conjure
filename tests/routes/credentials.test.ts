import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (must be declared before route imports)
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/auth", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("test-user-id"),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ success: true, remaining: 99 }),
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn().mockReturnValue({
    credentialProfile: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  }),
}));

const mockStore = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn().mockResolvedValue(true);
const mockList = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/vault/credentials", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vault/credentials")>();
  return {
    ...actual,
    storeCredentialProfile: (...args: unknown[]) => mockStore(...args),
    updateCredentialProfile: (...args: unknown[]) => mockUpdate(...args),
    deleteCredentialProfile: (...args: unknown[]) => mockDelete(...args),
    listCredentialProfiles: (...args: unknown[]) => mockList(...args),
  };
});

import { GET, POST, PATCH, DELETE } from "@/app/api/credentials/route";
import { getPrisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const routeCtx = { params: Promise.resolve({}) };

const validAwsBody = {
  provider: "aws",
  name: "Production",
  credentials: {
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  },
  defaultRegion: "us-east-1",
};

const validGcpBody = {
  provider: "gcp",
  name: "Staging",
  credentials: {
    serviceAccountJson: JSON.stringify({
      type: "service_account",
      project_id: "my-project",
      private_key_id: "kid",
      private_key: "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----\n",
      client_email: "sa@my-project.iam.gserviceaccount.com",
      client_id: "123",
    }),
  },
  defaultRegion: "us-central1",
};

const profileId = "550e8400-e29b-41d4-a716-446655440000";

const awsSummary = {
  id: profileId,
  provider: "aws" as const,
  name: "Production",
  hint: "AKIA...MPLE",
  defaultRegion: "us-east-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/credentials", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(id: string): Request {
  return new Request(`http://localhost/api/credentials?id=${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockStore.mockResolvedValue(awsSummary);
  mockUpdate.mockResolvedValue(awsSummary);
  mockDelete.mockResolvedValue(true);
  mockList.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// POST /api/credentials
// ---------------------------------------------------------------------------

describe("POST /api/credentials", () => {
  it("creates valid AWS credential profile and returns 201", async () => {
    const res = await POST(postRequest(validAwsBody), routeCtx);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.hint).toContain("...");
    expect(mockStore).toHaveBeenCalledTimes(1);
  });

  it("creates valid GCP credential profile and returns 201", async () => {
    const gcpSummary = { ...awsSummary, provider: "gcp", name: "Staging", hint: "project: my-project" };
    mockStore.mockResolvedValue(gcpSummary);
    const res = await POST(postRequest(validGcpBody), routeCtx);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.provider).toBe("gcp");
  });

  it("returns 400 when provider is missing", async () => {
    const res = await POST(
      postRequest({ ...validAwsBody, provider: undefined }),
      routeCtx,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid provider", async () => {
    const res = await POST(
      postRequest({ ...validAwsBody, provider: "azure" }),
      routeCtx,
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/aws.*gcp/);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(
      postRequest({ ...validAwsBody, name: undefined }),
      routeCtx,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid name", async () => {
    const res = await POST(
      postRequest({ ...validAwsBody, name: "x".repeat(51) }),
      routeCtx,
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/50/);
  });

  it("returns 400 when credentials are missing", async () => {
    const res = await POST(
      postRequest({ ...validAwsBody, credentials: undefined }),
      routeCtx,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid AWS credential format", async () => {
    const res = await POST(
      postRequest({
        ...validAwsBody,
        credentials: { accessKeyId: "bad", secretAccessKey: "bad" },
      }),
      routeCtx,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when defaultRegion is missing", async () => {
    const res = await POST(
      postRequest({ ...validAwsBody, defaultRegion: undefined }),
      routeCtx,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid region", async () => {
    const res = await POST(
      postRequest({ ...validAwsBody, defaultRegion: "invalid" }),
      routeCtx,
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when vault storage fails", async () => {
    mockStore.mockRejectedValue(new Error("Vault error"));
    const res = await POST(postRequest(validAwsBody), routeCtx);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /api/credentials
// ---------------------------------------------------------------------------

describe("GET /api/credentials", () => {
  it("returns empty array when no profiles exist", async () => {
    const res = await GET(new Request("http://localhost/api/credentials"), routeCtx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("returns profiles with masked hints", async () => {
    mockList.mockResolvedValue([awsSummary]);
    const res = await GET(new Request("http://localhost/api/credentials"), routeCtx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].hint).toContain("...");
    expect(data[0].name).toBe("Production");
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/credentials
// ---------------------------------------------------------------------------

describe("PATCH /api/credentials", () => {
  it("returns 400 when id is missing", async () => {
    const res = await PATCH(patchRequest({ name: "New Name" }), routeCtx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/id/);
  });

  it("returns 400 for invalid UUID", async () => {
    const res = await PATCH(patchRequest({ id: "not-a-uuid", name: "New" }), routeCtx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/UUID/);
  });

  it("returns 400 when no update fields provided", async () => {
    const res = await PATCH(patchRequest({ id: profileId }), routeCtx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/At least one/);
  });

  it("updates name only", async () => {
    const res = await PATCH(
      patchRequest({ id: profileId, name: "Updated" }),
      routeCtx,
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when profile not found (credential update requires pre-check)", async () => {
    (getPrisma as ReturnType<typeof vi.fn>).mockReturnValue({
      credentialProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });
    const res = await PATCH(
      patchRequest({
        id: profileId,
        credentials: validAwsBody.credentials,
      }),
      routeCtx,
    );
    expect(res.status).toBe(404);
  });

  it("validates credentials against the profile's provider", async () => {
    (getPrisma as ReturnType<typeof vi.fn>).mockReturnValue({
      credentialProfile: {
        findUnique: vi.fn().mockResolvedValue({
          provider: "aws",
          userId: "test-user-id",
        }),
      },
    });
    const res = await PATCH(
      patchRequest({
        id: profileId,
        credentials: { accessKeyId: "bad", secretAccessKey: "bad" },
      }),
      routeCtx,
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when update helper throws not found", async () => {
    mockUpdate.mockRejectedValue(new Error("Credential profile not found"));
    const res = await PATCH(
      patchRequest({ id: profileId, name: "New" }),
      routeCtx,
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/credentials
// ---------------------------------------------------------------------------

describe("DELETE /api/credentials", () => {
  it("deletes existing profile", async () => {
    const res = await DELETE(deleteRequest(profileId), routeCtx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);
  });

  it("returns 404 when profile not found", async () => {
    mockDelete.mockResolvedValue(false);
    const res = await DELETE(deleteRequest(profileId), routeCtx);
    expect(res.status).toBe(404);
  });

  it("returns 400 when id param is missing", async () => {
    const req = new Request("http://localhost/api/credentials", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await DELETE(req, routeCtx);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid UUID", async () => {
    const res = await DELETE(deleteRequest("not-a-uuid"), routeCtx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/UUID/);
  });

  it("returns 500 when vault deletion fails", async () => {
    mockDelete.mockRejectedValue(new Error("Vault error"));
    const res = await DELETE(deleteRequest(profileId), routeCtx);
    expect(res.status).toBe(500);
  });

  it("deletes existing profile with bodyless request (browser behavior)", async () => {
    const req = new Request(
      `http://localhost/api/credentials?id=${profileId}`,
      { method: "DELETE" },
    );
    const res = await DELETE(req, routeCtx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);
  });
});
