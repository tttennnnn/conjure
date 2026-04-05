export const dynamic = "force-dynamic";

import { createHandler, createGetHandler } from "@/lib/api/handler";
import { getPrisma } from "@/lib/prisma";
import {
  isValidTargetEnv,
  isValidIacTool,
  isValidModel,
  sanitizeSessionName,
  isValidGithubRepo,
} from "@/lib/sessions/validation";
import { createRateLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const sessionsLimiter = createRateLimiter("sessions", { maxRequests: 5, windowMs: 60_000 });

export const POST = createHandler<{
  name?: string;
  targetEnv?: string;
  iacTool?: string;
  model?: string;
  githubRepo?: string;
}>(
  { rateLimit: sessionsLimiter },
  async ({ userId, body }) => {
    const { name, targetEnv, iacTool, model, githubRepo } = body;

    if (!name || !targetEnv || !iacTool || !model) {
      return NextResponse.json(
        { error: "name, targetEnv, iacTool, and model are required" },
        { status: 400 },
      );
    }

    const sanitizedName = sanitizeSessionName(name);
    if (!sanitizedName) {
      return NextResponse.json(
        { error: "Session name must be 1-100 characters" },
        { status: 400 },
      );
    }

    if (!isValidTargetEnv(targetEnv)) {
      return NextResponse.json(
        { error: 'targetEnv must be "aws" or "gcp"' },
        { status: 400 },
      );
    }

    if (!isValidIacTool(iacTool)) {
      return NextResponse.json(
        { error: 'iacTool must be "terraform"' },
        { status: 400 },
      );
    }

    if (!isValidModel(model)) {
      return NextResponse.json(
        { error: "Invalid model" },
        { status: 400 },
      );
    }

    if (githubRepo && !isValidGithubRepo(githubRepo)) {
      return NextResponse.json(
        { error: 'githubRepo must be in "owner/repo" format' },
        { status: 400 },
      );
    }

    try {
      const session = await getPrisma().session.create({
        data: {
          userId,
          name: sanitizedName,
          targetEnv,
          iacTool,
          model,
          githubRepo: githubRepo || null,
        },
      });

      return NextResponse.json(session, { status: 201 });
    } catch (err) {
      console.error("Failed to create session:", err);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 },
      );
    }
  },
);

export const GET = createGetHandler({}, async ({ userId }) => {
  const sessions = await getPrisma().session.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      targetEnv: true,
      model: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(sessions);
});
