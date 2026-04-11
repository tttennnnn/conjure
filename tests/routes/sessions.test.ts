import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/auth", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("test-user-id"),
}));

vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => () => ({ success: true, remaining: 99 }),
}));

const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn().mockReturnValue({
    session: {
      create: (...args: unknown[]) => mockCreate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  }),
}));

import { POST, GET } from "@/app/api/sessions/route";

const routeCtx = { params: Promise.resolve({}) };

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({ id: "new-session-id", name: "Test" });
  mockFindMany.mockResolvedValue([]);
});

describe("POST /api/sessions", () => {
  const validBody = {
    name: "My Session",
    targetEnv: "aws",
    iacTool: "terraform",
    model: "claude-sonnet",
  };

  it("creates session with valid body", async () => {
    const res = await POST(postRequest(validBody), routeCtx);
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(postRequest({ ...validBody, name: undefined }), routeCtx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when targetEnv is invalid", async () => {
    const res = await POST(postRequest({ ...validBody, targetEnv: "azure" }), routeCtx);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/targetEnv/);
  });

  it("returns 400 when model is invalid", async () => {
    const res = await POST(postRequest({ ...validBody, model: "gpt-5" }), routeCtx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when iacTool is invalid", async () => {
    const res = await POST(postRequest({ ...validBody, iacTool: "pulumi" }), routeCtx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when session name is empty", async () => {
    const res = await POST(postRequest({ ...validBody, name: "   " }), routeCtx);
    expect(res.status).toBe(400);
  });

  it("returns 400 when githubBranch provided without githubRepo", async () => {
    const res = await POST(
      postRequest({ ...validBody, githubBranch: "main" }),
      routeCtx,
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/githubBranch requires githubRepo/);
  });

  it("accepts optional githubRepo and githubBranch", async () => {
    const res = await POST(
      postRequest({ ...validBody, githubRepo: "owner/repo", githubBranch: "main" }),
      routeCtx,
    );
    expect(res.status).toBe(201);
  });

  it("returns 500 when Prisma throws", async () => {
    mockCreate.mockRejectedValue(new Error("DB error"));
    const res = await POST(postRequest(validBody), routeCtx);
    expect(res.status).toBe(500);
  });
});

describe("GET /api/sessions", () => {
  it("returns session list for user", async () => {
    const sessions = [
      { id: "1", name: "Session 1", status: "active", targetEnv: "aws", model: "claude-sonnet", createdAt: new Date(), updatedAt: new Date() },
    ];
    mockFindMany.mockResolvedValue(sessions);

    const res = await GET(new Request("http://localhost/api/sessions"), routeCtx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Session 1");
  });

  it("returns empty array when no sessions", async () => {
    mockFindMany.mockResolvedValue([]);
    const res = await GET(new Request("http://localhost/api/sessions"), routeCtx);
    const data = await res.json();
    expect(data).toEqual([]);
  });
});
