import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/auth", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("test-user-id"),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ success: true, remaining: 99 }),
}));

vi.mock("@/lib/config/validate", () => ({
  validateConfigYaml: vi.fn().mockReturnValue({ valid: true, errors: [] }),
}));

vi.mock("@/lib/sessions/validation", () => ({
  sanitizeSessionName: vi.fn((name: string) => name.trim() || null),
}));

const mockFindUnique = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/prisma", () => {
  const prisma = {
    session: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    message: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
    $transaction: (fn: (tx: unknown) => unknown) => fn(prisma),
  };
  return { getPrisma: vi.fn().mockReturnValue(prisma) };
});

import { GET, PATCH, DELETE } from "@/app/api/sessions/[id]/route";

const sessionId = "550e8400-e29b-41d4-a716-446655440000";
const routeCtx = { params: Promise.resolve({ id: sessionId }) };

const existingSession = {
  id: sessionId,
  userId: "test-user-id",
  name: "My Session",
  targetEnv: "aws",
  model: "claude-sonnet",
  mermaidCode: "graph TD\n  A --> B",
  configYaml: "nodes:\n  A: {}",
  iacCode: null,
  iacStale: false,
  messages: [],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFindUnique.mockResolvedValue(existingSession);
  mockDelete.mockResolvedValue(existingSession);
  mockUpdate.mockResolvedValue({ ...existingSession, name: "Updated" });
  mockCreate.mockResolvedValue({ id: "msg-1", role: "event", content: "", eventKind: "diagram-updated-manual", createdAt: new Date("2026-01-01") });
});

// ---------------------------------------------------------------------------
// GET /api/sessions/[id]
// ---------------------------------------------------------------------------

describe("GET /api/sessions/[id]", () => {
  it("returns session when found", async () => {
    const res = await GET(
      new Request(`http://localhost/api/sessions/${sessionId}`),
      routeCtx,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(sessionId);
  });

  it("returns 404 when session not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await GET(
      new Request(`http://localhost/api/sessions/${sessionId}`),
      routeCtx,
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when session belongs to another user", async () => {
    mockFindUnique.mockResolvedValue({ ...existingSession, userId: "other-user" });
    const res = await GET(
      new Request(`http://localhost/api/sessions/${sessionId}`),
      routeCtx,
    );
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/sessions/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/sessions/[id]", () => {
  it("deletes session with bodyless request (browser behavior)", async () => {
    const res = await DELETE(
      new Request(`http://localhost/api/sessions/${sessionId}`, { method: "DELETE" }),
      routeCtx,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when session not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await DELETE(
      new Request(`http://localhost/api/sessions/${sessionId}`, { method: "DELETE" }),
      routeCtx,
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when session belongs to another user", async () => {
    mockFindUnique.mockResolvedValue({ ...existingSession, userId: "other-user" });
    const res = await DELETE(
      new Request(`http://localhost/api/sessions/${sessionId}`, { method: "DELETE" }),
      routeCtx,
    );
    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/sessions/[id]
// ---------------------------------------------------------------------------

describe("PATCH /api/sessions/[id]", () => {
  function patchRequest(body: Record<string, unknown>): Request {
    return new Request(`http://localhost/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("updates session name", async () => {
    const res = await PATCH(patchRequest({ name: "New Name" }), routeCtx);
    expect(res.status).toBe(200);
  });

  it("returns 400 when no update fields provided", async () => {
    const res = await PATCH(patchRequest({}), routeCtx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when session not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ name: "New Name" }), routeCtx);
    expect(res.status).toBe(404);
  });
});
