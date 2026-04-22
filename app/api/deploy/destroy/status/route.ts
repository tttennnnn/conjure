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
    if (res.status === 404) {
      // Job dropped from deploy-service memory (service restarted mid-job) — mark failed so the slot is reclaimable
      const lostMsg = "[Job lost — deploy service restarted while this job was running. Re-run the destroy.]";
      await getPrisma().session.update({
        where: { id: session.id },
        data: { lastDestroyStatus: "failed", lastDestroyOutput: lostMsg, status: "destroy_failed" },
      });
      return NextResponse.json({ status: "failed", output: lostMsg, error: lostMsg });
    }
    if (!res.ok) {
      return NextResponse.json({ error: "Deploy service error" }, { status: 502 });
    }
    statusData = await res.json() as DestroyStatusResponse;
  } catch {
    return NextResponse.json({ error: "Deploy service unreachable" }, { status: 503 });
  }

  // Persist on status transitions only — not every output change during streaming
  if (statusData.status !== session.lastDestroyStatus) {
    const updates: Record<string, unknown> = {
      lastDestroyStatus: statusData.status,
      lastDestroyOutput: statusData.output,
    };

    if (statusData.status === "completed") {
      updates.status = "active";
    } else if (statusData.status === "failed") {
      updates.status = "destroy_failed";
    }

    await getPrisma().session.update({
      where: { id: session.id },
      data: updates,
    });
  }

  return NextResponse.json(statusData);
});
