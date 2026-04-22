export const dynamic = "force-dynamic";

import { createHandler } from "@/lib/api/handler";
import { getPrisma } from "@/lib/prisma";
import { readCredentialProfile } from "@/lib/vault/credentials";
import { NextResponse } from "next/server";
import type { IacFiles } from "@/components/session/CodePanel";

const DEPLOY_SERVICE_URL = process.env.DEPLOY_SERVICE_URL;
const DEPLOY_SERVICE_API_KEY = process.env.DEPLOY_SERVICE_API_KEY;

interface PlanRequestBody {
  sessionId?: unknown;
  credentialProfileId?: unknown;
  oneOffCredentials?: unknown;
  region?: unknown;
  stateBackend?: unknown;
}

export const POST = createHandler<PlanRequestBody>(
  {},
  async ({ userId, body }) => {
    const { sessionId, credentialProfileId, oneOffCredentials, region, stateBackend } = body;

    // Validate required fields
    if (typeof sessionId !== "string" || sessionId.length === 0) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }
    if (typeof region !== "string" || region.length === 0) {
      return NextResponse.json({ error: "region is required" }, { status: 400 });
    }
    if (credentialProfileId === undefined && oneOffCredentials === undefined) {
      return NextResponse.json(
        { error: "Provide credentialProfileId or oneOffCredentials" },
        { status: 400 },
      );
    }
    if (credentialProfileId !== undefined && oneOffCredentials !== undefined) {
      return NextResponse.json(
        { error: "Provide credentialProfileId or oneOffCredentials, not both" },
        { status: 400 },
      );
    }

    if (!DEPLOY_SERVICE_URL || !DEPLOY_SERVICE_API_KEY) {
      return NextResponse.json(
        { error: "Deploy service not configured" },
        { status: 503 },
      );
    }

    // Fetch and verify session ownership
    const session = await getPrisma().session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (!session.iacCode) {
      return NextResponse.json({ error: "No code generated yet" }, { status: 400 });
    }
    if (session.iacStale) {
      return NextResponse.json(
        { error: "Code is outdated — regenerate before running plan" },
        { status: 409 },
      );
    }

    // Validate stateBackend if provided
    if (stateBackend !== undefined && (typeof stateBackend !== "object" || stateBackend === null)) {
      return NextResponse.json({ error: "stateBackend must be an object" }, { status: 400 });
    }

    // Atomically claim the plan slot — prevents duplicate in-flight plans from a race condition.
    // Allow overriding a stuck "pending"/"running" status if it's been more than 25 minutes.
    // Must exceed deploy-service HARD_TIMEOUT_MS (20 min) + SIGKILL grace (30s).
    // Uses lastPlanClaimedAt (not updatedAt) so unrelated session writes don't reset the window.
    const STALE_THRESHOLD_MS = 25 * 60 * 1000;
    const staleDeadline = new Date(Date.now() - STALE_THRESHOLD_MS);

    const claimed = await getPrisma().session.updateMany({
      where: {
        id: sessionId,
        OR: [
          { lastPlanStatus: { notIn: ["pending", "running"] } },
          { lastPlanStatus: null },
          { lastPlanClaimedAt: { lt: staleDeadline } },
        ],
      },
      data: { lastPlanStatus: "pending", lastPlanOutput: null, planOutputStale: false, applyOutputStale: true, lastPlanClaimedAt: new Date() },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: "A plan is already in progress" }, { status: 409 });
    }

    // Release the atomically claimed slot so the user can retry after an error
    // sessionId is cast here — it was narrowed to string by the earlier validation guard
    async function releasePlanSlot() {
      await getPrisma().session.update({
        where: { id: sessionId as string },
        data: { lastPlanStatus: "failed" },
      });
    }

    // Resolve credentials
    let credentials: Record<string, string>;
    const provider = session.targetEnv;

    if (credentialProfileId !== undefined) {
      if (typeof credentialProfileId !== "string") {
        await releasePlanSlot();
        return NextResponse.json({ error: "credentialProfileId must be a string" }, { status: 400 });
      }
      const profile = await readCredentialProfile(userId, credentialProfileId);
      if (!profile) {
        await releasePlanSlot();
        return NextResponse.json({ error: "Credential profile not found" }, { status: 404 });
      }
      if (profile.provider !== provider) {
        await releasePlanSlot();
        return NextResponse.json(
          { error: `Credential profile is for ${profile.provider}, session targets ${provider}` },
          { status: 400 },
        );
      }
      credentials = profile.credentials as unknown as Record<string, string>;
    } else {
      if (typeof oneOffCredentials !== "object" || oneOffCredentials === null) {
        await releasePlanSlot();
        return NextResponse.json({ error: "oneOffCredentials must be an object" }, { status: 400 });
      }
      credentials = oneOffCredentials as Record<string, string>;
    }

    // Send to deploy service
    const iacFiles = session.iacCode as unknown as IacFiles;
    const hcl: Record<string, string> = {
      "main.tf": iacFiles.mainTf,
      "variables.tf": iacFiles.variablesTf,
      "outputs.tf": iacFiles.outputsTf,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEPLOY_SERVICE_API_KEY}`,
    };

    let jobId: string;
    try {
      const res = await fetch(`${DEPLOY_SERVICE_URL}/jobs/plan`, {
        method: "POST",
        headers,
        body: JSON.stringify({ hcl, provider, credentials, region, ...(stateBackend && { stateBackend }) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        await releasePlanSlot();
        return NextResponse.json(
          { error: (err as { error?: string }).error ?? "Deploy service error" },
          { status: 502 },
        );
      }
      const data = await res.json() as { jobId: string };
      jobId = data.jobId;
    } catch {
      await releasePlanSlot();
      return NextResponse.json({ error: "Deploy service unreachable" }, { status: 503 });
    }

    // Persist job ID and plan inputs — lastPlanStatus is already "pending" from the atomic claim
    await getPrisma().session.update({
      where: { id: sessionId },
      data: {
        deployJobId: jobId,
        planRegion: region,
        // Bind the credential identity to this plan so apply cannot switch to a different account
        planCredentialProfileId: typeof credentialProfileId === "string" ? credentialProfileId : null,
        ...(stateBackend !== undefined && { stateBackend: stateBackend as object }),
      },
    });

    return NextResponse.json({ jobId });
  },
);
