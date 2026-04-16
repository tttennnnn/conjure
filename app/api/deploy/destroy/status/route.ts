export const dynamic = "force-dynamic";

import { createGetHandler } from "@/lib/api/handler";
import { getPrisma } from "@/lib/prisma";
import { createRateLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const rateLimiter = createRateLimiter("deploy-destroy-status", { maxRequests: 60, windowMs: 60_000 });

const DEPLOY_SERVICE_URL = process.env.DEPLOY_SERVICE_URL;
const DEPLOY_SERVICE_API_KEY = process.env.DEPLOY_SERVICE_API_KEY;

export type DestroyStatus = "pending" | "running" | "completed" | "failed";

export interface DestroyStatusResponse {
  status: DestroyStatus;
  output: string;
  error: string | null;
}

export const GET = createGetHandler({ rateLimit: rateLimiter }, async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  if (!DEPLOY_SERVICE_URL || !DEPLOY_SERVICE_API_KEY) {
    return NextResponse.json({ error: "Deploy service not configured" }, { status: 503 });
  }

  const session = await getPrisma().session.findFirst({
    where: { destroyJobId: jobId, userId },
  });
  if (!session) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${DEPLOY_SERVICE_API_KEY}`,
  };

  let statusData: DestroyStatusResponse;
  try {
    const res = await fetch(`${DEPLOY_SERVICE_URL}/jobs/${jobId}`, { headers });
    if (!res.ok) {
      return NextResponse.json({ error: "Deploy service error" }, { status: 502 });
    }
    statusData = await res.json() as DestroyStatusResponse;
  } catch {
    return NextResponse.json({ error: "Deploy service unreachable" }, { status: 503 });
  }

  const updates: Record<string, unknown> = {};

  if (statusData.status !== session.lastDestroyStatus) {
    updates.lastDestroyStatus = statusData.status;
  }
  if (statusData.output !== session.lastDestroyOutput) {
    updates.lastDestroyOutput = statusData.output;
  }

  // Resources are gone — reset session to active so it can be re-used
  if (statusData.status === "completed" && session.status !== "active") {
    updates.status = "active";
  } else if (statusData.status === "failed" && session.status !== "destroy_failed") {
    updates.status = "destroy_failed";
  }

  if (Object.keys(updates).length > 0) {
    await getPrisma().session.update({
      where: { id: session.id },
      data: updates,
    });
  }

  return NextResponse.json(statusData);
});
