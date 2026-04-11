import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/auth", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("test-user-id"),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ success: true, remaining: 99 }),
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn().mockReturnValue({}),
}));

const mockStoreApiKey = vi.fn().mockResolvedValue(undefined);
const mockGetApiKey = vi.fn().mockResolvedValue("sk-ant-realkey123456789");
const mockDeleteApiKey = vi.fn().mockResolvedValue(true);
const mockListApiKeys = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/vault/api-keys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vault/api-keys")>();
  return {
    ...actual,
    storeApiKey: (...args: unknown[]) => mockStoreApiKey(...args),
    getApiKey: (...args: unknown[]) => mockGetApiKey(...args),
    deleteApiKey: (...args: unknown[]) => mockDeleteApiKey(...args),
    listApiKeys: (...args: unknown[]) => mockListApiKeys(...args),
  };
});

import { GET, POST, DELETE } from "@/app/api/api-keys/route";

const routeCtx = { params: Promise.resolve({}) };

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteRequest(provider: string): Request {
  return new Request(`http://localhost/api/api-keys?provider=${provider}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockListApiKeys.mockResolvedValue([]);
  mockGetApiKey.mockResolvedValue("sk-ant-realkey123456789");
  mockStoreApiKey.mockResolvedValue(undefined);
  mockDeleteApiKey.mockResolvedValue(true);
});

describe("POST /api/api-keys", () => {
  it("stores valid anthropic key and returns masked hint", async () => {
    const res = await POST(
      postRequest({ provider: "anthropic", key: "sk-ant-abcdefghij1234567890" }),
      routeCtx,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.provider).toBe("anthropic");
    expect(data.key_hint).toContain("...");
    expect(mockStoreApiKey).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when provider is missing", async () => {
    const res = await POST(postRequest({ key: "sk-ant-abcdefghij1234567890" }), routeCtx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when key is missing", async () => {
    const res = await POST(postRequest({ provider: "anthropic" }), routeCtx);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid provider", async () => {
    const res = await POST(
      postRequest({ provider: "openai", key: "sk-abcdefghij1234567890" }),
      routeCtx,
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/anthropic/);
  });

  it("returns 400 for invalid key format", async () => {
    const res = await POST(
      postRequest({ provider: "anthropic", key: "wrong-prefix-1234567890" }),
      routeCtx,
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when storage fails", async () => {
    mockStoreApiKey.mockRejectedValue(new Error("Vault error"));
    const res = await POST(
      postRequest({ provider: "anthropic", key: "sk-ant-abcdefghij1234567890" }),
      routeCtx,
    );
    expect(res.status).toBe(500);
  });
});

describe("GET /api/api-keys", () => {
  it("returns empty array when no keys", async () => {
    const res = await GET(new Request("http://localhost/api/api-keys"), routeCtx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("returns masked key hints", async () => {
    mockListApiKeys.mockResolvedValue([
      { provider: "anthropic", createdAt: new Date("2025-01-01") },
    ]);
    const res = await GET(new Request("http://localhost/api/api-keys"), routeCtx);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].provider).toBe("anthropic");
    expect(data[0].key_hint).toContain("...");
  });
});

describe("DELETE /api/api-keys", () => {
  it("deletes existing key", async () => {
    const res = await DELETE(deleteRequest("anthropic"), routeCtx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);
  });

  it("returns 404 when key not found", async () => {
    mockDeleteApiKey.mockResolvedValue(false);
    const res = await DELETE(deleteRequest("anthropic"), routeCtx);
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid provider", async () => {
    const res = await DELETE(deleteRequest("openai"), routeCtx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when provider param is missing", async () => {
    const req = new Request("http://localhost/api/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await DELETE(req, routeCtx);
    expect(res.status).toBe(400);
  });
});
