export const dynamic = "force-dynamic";

import { createGetHandler } from "@/lib/api/handler";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const DEPLOY_SERVICE_URL = process.env.DEPLOY_SERVICE_URL;
const DEPLOY_SERVICE_API_KEY = process.env.DEPLOY_SERVICE_API_KEY;

export type PlanStatus = "pending" | "running" | "completed" | "failed";

export interface PlanStatusResponse {
  status: PlanStatus;
  output: string;
  error: string | null;
}

export const GET = createGetHandler({}, async ({ userId, request }) => {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  if (!DEPLOY_SERVICE_URL || !DEPLOY_SERVICE_API_KEY) {
    return NextResponse.json({ error: "Deploy service not configured" }, { status: 503 });
  }

  // Verify the job belongs to this user
  const session = await getPrisma().session.findFirst({
    where: { deployJobId: jobId, userId },
  });
  if (!session) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Proxy to deploy service
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${DEPLOY_SERVICE_API_KEY}`,
  };

  let statusData: PlanStatusResponse;
  try {
    const res = await fetch(`${DEPLOY_SERVICE_URL}/jobs/${jobId}`, { headers });
    if (!res.ok) {
      return NextResponse.json({ error: "Deploy service error" }, { status: 502 });
    }
    statusData = await res.json() as PlanStatusResponse;
  } catch {
    return NextResponse.json({ error: "Deploy service unreachable" }, { status: 503 });
  }

  // Persist latest status to DB so users can resume after navigating away
  if (statusData.status !== session.lastPlanStatus || statusData.output !== session.lastPlanOutput) {
    await getPrisma().session.update({
      where: { id: session.id },
      data: {
        lastPlanStatus: statusData.status,
        lastPlanOutput: statusData.output,
      },
    });
  }

  return NextResponse.json(statusData);
});
