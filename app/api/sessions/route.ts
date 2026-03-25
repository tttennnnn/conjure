export const dynamic = "force-dynamic";

import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { getPrisma } from "@/lib/prisma";
import {
  isValidTargetEnv,
  isValidIacTool,
  isValidModel,
} from "@/lib/sessions/validation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    targetEnv?: string;
    iacTool?: string;
    model?: string;
    githubRepo?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, targetEnv, iacTool, model, githubRepo } = body;

  if (!name || !targetEnv || !iacTool || !model) {
    return NextResponse.json(
      { error: "name, targetEnv, iacTool, and model are required" },
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
      { error: 'iacTool must be "terraform" or "opentofu"' },
      { status: 400 },
    );
  }

  if (!isValidModel(model)) {
    return NextResponse.json(
      { error: "Invalid model" },
      { status: 400 },
    );
  }

  try {
    const session = await getPrisma().session.create({
      data: {
        userId,
        name,
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
}

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}
