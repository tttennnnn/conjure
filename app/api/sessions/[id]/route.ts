export const dynamic = "force-dynamic";

import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { getPrisma } from "@/lib/prisma";
import { validateConfigYaml } from "@/lib/config/validate";
import { sanitizeSessionName } from "@/lib/sessions/validation";
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

  let body: { configYaml?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { configYaml, name } = body;

  if (configYaml === undefined && name === undefined) {
    return NextResponse.json({ error: "Provide configYaml or name" }, { status: 400 });
  }

  const session = await getPrisma().session.findUnique({ where: { id } });
  if (!session || session.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string") {
      return NextResponse.json({ error: "name must be a string" }, { status: 400 });
    }
    const sanitized = sanitizeSessionName(name);
    if (!sanitized) {
      return NextResponse.json({ error: "Session name must be 1-100 characters" }, { status: 400 });
    }
    updateData.name = sanitized;
  }

  if (configYaml !== undefined) {
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
    updateData.configYaml = configYaml;
    if (session.iacCode) updateData.iacStale = true;
  }

  const updated = await getPrisma().session.update({ where: { id }, data: updateData });

  return NextResponse.json({ name: updated.name, configYaml: updated.configYaml, iacStale: updated.iacStale });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const session = await getPrisma().session.findUnique({ where: { id } });
  if (!session || session.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  await getPrisma().session.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
