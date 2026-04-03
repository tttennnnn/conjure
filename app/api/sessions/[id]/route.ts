export const dynamic = "force-dynamic";

import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { getPrisma } from "@/lib/prisma";
import { validateConfigYaml } from "@/lib/config/validate";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const session = await getPrisma().session.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { configYaml?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { configYaml } = body;
  if (typeof configYaml !== "string") {
    return NextResponse.json({ error: "configYaml must be a string" }, { status: 400 });
  }

  const validation = validateConfigYaml(configYaml);
  if (!validation.valid) {
    return NextResponse.json(
      { error: `Invalid config YAML: ${validation.errors.join(", ")}` },
      { status: 400 },
    );
  }

  const session = await getPrisma().session.findUnique({ where: { id } });
  if (!session || session.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const updated = await getPrisma().session.update({
    where: { id },
    data: {
      configYaml,
      // Mark code stale if code already exists
      ...(session.iacCode ? { iacStale: true } : {}),
    },
  });

  return NextResponse.json({ configYaml: updated.configYaml, iacStale: updated.iacStale });
}
