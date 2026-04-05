import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { NextResponse } from "next/server";

type RateLimiter = (key: string) => { success: boolean };

interface HandlerContext<TBody = unknown> {
  userId: string;
  body: TBody;
  request: Request;
  params: Record<string, string>;
}

interface GetHandlerContext {
  userId: string;
  request: Request;
  params: Record<string, string>;
}

type RouteContext = { params: Promise<Record<string, string>> };

/** Wrap a POST/PATCH/DELETE handler with auth, optional rate limiting, and JSON body parsing. */
export function createHandler<TBody = unknown>(
  config: { rateLimit?: RateLimiter },
  handler: (ctx: HandlerContext<TBody>) => Promise<NextResponse>,
) {
  return async (request: Request, routeCtx: RouteContext = { params: Promise.resolve({}) }): Promise<NextResponse> => {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (config.rateLimit) {
      const limit = config.rateLimit(userId);
      if (!limit.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }

    let body: TBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const params = await routeCtx.params;
    return handler({ userId, body, request, params });
  };
}

/** Wrap a GET handler with auth and optional rate limiting. No body parsing. */
export function createGetHandler(
  config: { rateLimit?: RateLimiter },
  handler: (ctx: GetHandlerContext) => Promise<NextResponse>,
) {
  return async (request: Request, routeCtx: RouteContext = { params: Promise.resolve({}) }): Promise<NextResponse> => {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (config.rateLimit) {
      const limit = config.rateLimit(userId);
      if (!limit.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }

    const params = await routeCtx.params;
    return handler({ userId, request, params });
  };
}
