import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHandler, createGetHandler } from "@/lib/api/handler";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";

vi.mock("@/lib/supabase/auth", () => ({
  getAuthenticatedUserId: vi.fn(),
}));

const mockAuth = vi.mocked(getAuthenticatedUserId);
const routeCtx = { params: Promise.resolve({}) };

function jsonRequest(body: unknown, url = "http://localhost/api/test"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue("test-user-id");
});

describe("createHandler", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const handler = createHandler({}, async () => {
      throw new Error("should not reach");
    });
    const res = await handler(jsonRequest({}), routeCtx);
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    const rateLimiter = () => ({ success: false });
    const handler = createHandler({ rateLimit: rateLimiter }, async () => {
      throw new Error("should not reach");
    });
    const res = await handler(jsonRequest({}), routeCtx);
    expect(res.status).toBe(429);
  });

  it("returns 400 on invalid JSON body", async () => {
    const handler = createHandler({}, async () => {
      throw new Error("should not reach");
    });
    const badRequest = new Request("http://localhost/api/test", {
      method: "POST",
      body: "not json",
    });
    const res = await handler(badRequest, routeCtx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/Invalid JSON/);
  });

  it("passes userId and body to inner handler", async () => {
    const inner = vi.fn().mockImplementation(async ({ userId, body }) => {
      return new Response(JSON.stringify({ userId, body }), { status: 200 });
    });
    const handler = createHandler({}, inner);
    await handler(jsonRequest({ foo: "bar" }), routeCtx);
    expect(inner).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "test-user-id", body: { foo: "bar" } }),
    );
  });

  it("resolves route params", async () => {
    const inner = vi.fn().mockImplementation(async () => new Response("ok"));
    const handler = createHandler({}, inner);
    const ctxWithParams = { params: Promise.resolve({ id: "abc-123" }) };
    await handler(jsonRequest({}), ctxWithParams);
    expect(inner).toHaveBeenCalledWith(
      expect.objectContaining({ params: { id: "abc-123" } }),
    );
  });
});

describe("createGetHandler", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const handler = createGetHandler({}, async () => {
      throw new Error("should not reach");
    });
    const res = await handler(new Request("http://localhost/api/test"), routeCtx);
    expect(res.status).toBe(401);
  });

  it("does not parse body", async () => {
    const inner = vi.fn().mockImplementation(async ({ userId }) => {
      return new Response(JSON.stringify({ userId }), { status: 200 });
    });
    const handler = createGetHandler({}, inner);
    await handler(new Request("http://localhost/api/test"), routeCtx);
    expect(inner).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "test-user-id" }),
    );
    // GetHandlerContext has no body field
    const callArg = inner.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty("body");
  });
});
