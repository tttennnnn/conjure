export const dynamic = "force-dynamic";

import { createHandler } from "@/lib/api/handler";
import { getPrisma } from "@/lib/prisma";
import { readCredentialProfile } from "@/lib/vault/credentials";
import { NextResponse } from "next/server";
import type { IacFiles } from "@/components/session/CodePanel";

const DEPLOY_SERVICE_URL = process.env.DEPLOY_SERVICE_URL;
const DEPLOY_SERVICE_API_KEY = process.env.DEPLOY_SERVICE_API_KEY;

interface ApplyRequestBody {
  sessionId?: unknown;
  credentialProfileId?: unknown;
  oneOffCredentials?: unknown;
}

export const POST = createHandler<ApplyRequestBody>(
  {},
  async ({ userId, body }) => {
    const { sessionId, credentialProfileId, oneOffCredentials } = body;

    // Validate required fields
    if (typeof sessionId !== "string" || sessionId.length === 0) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
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
        { error: "Code is outdated — regenerate before applying" },
        { status: 409 },
      );
    }
    if (session.lastPlanStatus !== "completed") {
      return NextResponse.json(
        { error: "Run a successful plan before applying" },
        { status: 400 },
      );
    }

    // Enforce credential binding: apply must use the same identity as the reviewed plan.
    // This prevents applying reviewed HCL to a different cloud account than the one that was planned.
    if (session.planCredentialProfileId !== null) {
      // Plan used a saved profile — apply must use the same profile
      if (credentialProfileId !== session.planCredentialProfileId) {
        return NextResponse.json(
          { error: "Apply must use the same credential profile as the plan. Re-run the plan if you want to use different credentials." },
          { status: 409 },
        );
      }
    } else {
      // Plan used one-off credentials — apply must also use one-off credentials
      if (credentialProfileId !== undefined) {
        return NextResponse.json(
          { error: "Plan was run with one-off credentials. Apply must also use one-off credentials." },
          { status: 409 },
        );
      }
    }

    // Use the region and state backend from the successful plan, not from the request.
    // This ensures apply always runs against exactly what was reviewed.
    const region = session.planRegion;
    const stateBackend = session.stateBackend;
    if (!region || !stateBackend) {
      return NextResponse.json(
        { error: "Plan inputs missing — run plan first" },
        { status: 400 },
      );
    }

    // Atomically claim the apply slot — prevents duplicate in-flight applies from a race condition.
    // Allow overriding a stuck "pending"/"running" status if it's been more than 10 minutes.
    const STALE_THRESHOLD_MS = 10 * 60 * 1000;
    const staleDeadline = new Date(Date.now() - STALE_THRESHOLD_MS);

    const claimed = await getPrisma().session.updateMany({
      where: {
        id: sessionId,
        OR: [
          { lastApplyStatus: { notIn: ["pending", "running"] } },
          { lastApplyStatus: null },
          { updatedAt: { lt: staleDeadline } },
        ],
      },
      data: { lastApplyStatus: "pending", lastApplyOutput: null },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: "An apply is already in progress" }, { status: 409 });
    }

    // Release the atomically claimed slot so the user can retry after an error
    // sessionId is cast here — it was narrowed to string by the earlier validation guard
    async function releaseApplySlot() {
      await getPrisma().session.update({
        where: { id: sessionId as string },
        data: { lastApplyStatus: "failed" },
      });
    }

    // Resolve credentials
    let credentials: Record<string, string>;
    const provider = session.targetEnv;

    if (credentialProfileId !== undefined) {
      if (typeof credentialProfileId !== "string") {
        await releaseApplySlot();
        return NextResponse.json({ error: "credentialProfileId must be a string" }, { status: 400 });
      }
      const profile = await readCredentialProfile(userId, credentialProfileId);
      if (!profile) {
        await releaseApplySlot();
        return NextResponse.json({ error: "Credential profile not found" }, { status: 404 });
      }
      if (profile.provider !== provider) {
        await releaseApplySlot();
        return NextResponse.json(
          { error: `Credential profile is for ${profile.provider}, session targets ${provider}` },
          { status: 400 },
        );
      }
      credentials = profile.credentials as unknown as Record<string, string>;
    } else {
      if (typeof oneOffCredentials !== "object" || oneOffCredentials === null) {
        await releaseApplySlot();
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
      const res = await fetch(`${DEPLOY_SERVICE_URL}/jobs/apply`, {
        method: "POST",
        headers,
        body: JSON.stringify({ hcl, provider, credentials, region, stateBackend }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        await releaseApplySlot();
        return NextResponse.json(
          { error: (err as { error?: string }).error ?? "Deploy service error" },
          { status: 502 },
        );
      }
      const data = await res.json() as { jobId: string };
      jobId = data.jobId;
    } catch {
      await releaseApplySlot();
      return NextResponse.json({ error: "Deploy service unreachable" }, { status: 503 });
    }

    // Persist job ID — lastApplyStatus is already "pending" from the atomic claim
    await getPrisma().session.update({
      where: { id: sessionId },
      data: { applyJobId: jobId },
    });

    return NextResponse.json({ jobId });
  },
);
