export const dynamic = "force-dynamic";

import { createHandler } from "@/lib/api/handler";
import { getPrisma } from "@/lib/prisma";
import { readCredentialProfile } from "@/lib/vault/credentials";
import { createRateLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import type { IacFiles } from "@/components/session/CodePanel";

const rateLimiter = createRateLimiter("deploy-destroy", { maxRequests: 3, windowMs: 60_000 });

const DEPLOY_SERVICE_URL = process.env.DEPLOY_SERVICE_URL;
const DEPLOY_SERVICE_API_KEY = process.env.DEPLOY_SERVICE_API_KEY;

interface DestroyRequestBody {
  sessionId?: unknown;
  credentialProfileId?: unknown;
  oneOffCredentials?: unknown;
}

export const POST = createHandler<DestroyRequestBody>(
  { rateLimit: rateLimiter },
  async ({ userId, body }) => {
    const { sessionId, credentialProfileId, oneOffCredentials } = body;

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

    const session = await getPrisma().session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (!session.iacCode) {
      return NextResponse.json({ error: "No code generated yet" }, { status: 400 });
    }
    if (session.lastApplyStatus !== "completed") {
      return NextResponse.json(
        { error: "Destroy requires a successful apply first" },
        { status: 400 },
      );
    }

    // Same credential binding as apply — destroy must use the same identity
    if (session.planCredentialProfileId !== null) {
      if (credentialProfileId !== session.planCredentialProfileId) {
        return NextResponse.json(
          { error: "Destroy must use the same credential profile as the plan." },
          { status: 409 },
        );
      }
    } else {
      if (credentialProfileId !== undefined) {
        return NextResponse.json(
          { error: "Plan was run with one-off credentials. Destroy must also use one-off credentials." },
          { status: 409 },
        );
      }
    }

    const region = session.planRegion;
    const stateBackend = session.stateBackend;
    if (!region || !stateBackend) {
      return NextResponse.json(
        { error: "Plan inputs missing — run plan first" },
        { status: 400 },
      );
    }

    // Atomic slot claim — prevent duplicate in-flight destroys
    const STALE_THRESHOLD_MS = 10 * 60 * 1000;
    const staleDeadline = new Date(Date.now() - STALE_THRESHOLD_MS);

    const claimed = await getPrisma().session.updateMany({
      where: {
        id: sessionId,
        OR: [
          { lastDestroyStatus: { notIn: ["pending", "running"] } },
          { lastDestroyStatus: null },
          { updatedAt: { lt: staleDeadline } },
        ],
      },
      data: { lastDestroyStatus: "pending", lastDestroyOutput: null },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: "A destroy is already in progress" }, { status: 409 });
    }

    async function releaseDestroySlot() {
      await getPrisma().session.update({
        where: { id: sessionId as string },
        data: { lastDestroyStatus: "failed" },
      });
    }

    let credentials: Record<string, string>;
    const provider = session.targetEnv;

    if (credentialProfileId !== undefined) {
      if (typeof credentialProfileId !== "string") {
        await releaseDestroySlot();
        return NextResponse.json({ error: "credentialProfileId must be a string" }, { status: 400 });
      }
      const profile = await readCredentialProfile(userId, credentialProfileId);
      if (!profile) {
        await releaseDestroySlot();
        return NextResponse.json({ error: "Credential profile not found" }, { status: 404 });
      }
      if (profile.provider !== provider) {
        await releaseDestroySlot();
        return NextResponse.json(
          { error: `Credential profile is for ${profile.provider}, session targets ${provider}` },
          { status: 400 },
        );
      }
      credentials = profile.credentials as unknown as Record<string, string>;
    } else {
      if (typeof oneOffCredentials !== "object" || oneOffCredentials === null) {
        await releaseDestroySlot();
        return NextResponse.json({ error: "oneOffCredentials must be an object" }, { status: 400 });
      }
      credentials = oneOffCredentials as Record<string, string>;
    }

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
      const res = await fetch(`${DEPLOY_SERVICE_URL}/jobs/destroy`, {
        method: "POST",
        headers,
        body: JSON.stringify({ hcl, provider, credentials, region, stateBackend }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        await releaseDestroySlot();
        return NextResponse.json(
          { error: (err as { error?: string }).error ?? "Deploy service error" },
          { status: 502 },
        );
      }
      const data = await res.json() as { jobId: string };
      jobId = data.jobId;
    } catch {
      await releaseDestroySlot();
      return NextResponse.json({ error: "Deploy service unreachable" }, { status: 503 });
    }

    await getPrisma().session.update({
      where: { id: sessionId },
      data: { destroyJobId: jobId },
    });

    return NextResponse.json({ jobId });
  },
);
