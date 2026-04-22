export const dynamic = "force-dynamic";

import { createGetHandler } from "@/lib/api/handler";
import { getPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const DEPLOY_SERVICE_URL = process.env.DEPLOY_SERVICE_URL;
const DEPLOY_SERVICE_API_KEY = process.env.DEPLOY_SERVICE_API_KEY;

export type ApplyStatus = "pending" | "running" | "completed" | "failed";

export interface ApplyStatusResponse {
  status: ApplyStatus;
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
    where: { applyJobId: jobId, userId },
  });
  if (!session) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Proxy to deploy service
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${DEPLOY_SERVICE_API_KEY}`,
  };

  let statusData: ApplyStatusResponse;
  try {
    const res = await fetch(`${DEPLOY_SERVICE_URL}/jobs/${jobId}`, { headers });
    if (res.status === 404) {
      // Job dropped from deploy-service memory (service restarted mid-job) — mark failed so the slot is reclaimable
      const lostMsg = "[Job lost — deploy service restarted while this job was running. Re-run the plan and apply.]";
      await getPrisma().session.update({
        where: { id: session.id },
        data: { lastApplyStatus: "failed", lastApplyOutput: lostMsg, status: "deploy_failed" },
      });
      return NextResponse.json({ status: "failed", output: lostMsg, error: lostMsg });
    }
    if (!res.ok) {
      return NextResponse.json({ error: "Deploy service error" }, { status: 502 });
    }
    statusData = await res.json() as ApplyStatusResponse;
  } catch {
    return NextResponse.json({ error: "Deploy service unreachable" }, { status: 503 });
  }

  // Persist latest status and update session status on terminal states
  const updates: Record<string, unknown> = {};

  if (statusData.status !== session.lastApplyStatus) {
    updates.lastApplyStatus = statusData.status;
  }
  if (statusData.output !== session.lastApplyOutput) {
    updates.lastApplyOutput = statusData.output;
  }

  // Update session lifecycle status on terminal apply states
  if (statusData.status === "completed" && session.status !== "deployed") {
    updates.status = "deployed";
  } else if (statusData.status === "failed" && session.status !== "deploy_failed") {
    updates.status = "deploy_failed";
  }

  if (Object.keys(updates).length > 0) {
    await getPrisma().session.update({
      where: { id: session.id },
      data: updates,
    });
  }

  return NextResponse.json(statusData);
});
