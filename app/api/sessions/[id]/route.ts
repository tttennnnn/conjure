export const dynamic = "force-dynamic";

import { createHandler, createGetHandler, createDeleteHandler } from "@/lib/api/handler";
import { getPrisma } from "@/lib/prisma";
import { validateConfigYaml } from "@/lib/config/validate";
import { sanitizeSessionName } from "@/lib/sessions/validation";
import { NextResponse } from "next/server";
import type { ChatMessageData, EventKind } from "@/lib/chat/types";

export const GET = createGetHandler({}, async ({ userId, params }) => {
  const id = params.id!;
  const session = await getPrisma().session.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session || session.userId !== userId) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
});

export const PATCH = createHandler<{ configYaml?: unknown; name?: unknown; mermaidCode?: unknown }>(
  {},
  async ({ userId, params, body }) => {
    const id = params.id!;
    const { configYaml, name, mermaidCode } = body;

    if (configYaml === undefined && name === undefined && mermaidCode === undefined) {
      return NextResponse.json({ error: "Provide configYaml, name, or mermaidCode" }, { status: 400 });
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

    if (mermaidCode !== undefined) {
      if (typeof mermaidCode !== "string" || mermaidCode.trim().length === 0) {
        return NextResponse.json({ error: "mermaidCode must be a non-empty string" }, { status: 400 });
      }
      updateData.mermaidCode = mermaidCode;
      if (session.iacCode) updateData.iacStale = true;
    }

    const prisma = getPrisma();
    const updated = await prisma.session.update({ where: { id }, data: updateData });

    // Best-effort event logging — don't fail the PATCH response if this throws
    const eventMessages: ChatMessageData[] = [];
    try {
      if (mermaidCode !== undefined) {
        const ev = await prisma.message.create({
          data: { sessionId: id, role: "event", content: "", eventKind: "diagram-updated-manual" satisfies EventKind },
        });
        eventMessages.push({ id: ev.id, role: ev.role, content: ev.content, createdAt: ev.createdAt.toISOString(), eventKind: ev.eventKind as EventKind });
      }
      if (configYaml !== undefined) {
        const ev = await prisma.message.create({
          data: { sessionId: id, role: "event", content: "", eventKind: "config-updated-manual" satisfies EventKind },
        });
        eventMessages.push({ id: ev.id, role: ev.role, content: ev.content, createdAt: ev.createdAt.toISOString(), eventKind: ev.eventKind as EventKind });
      }
    } catch (eventErr) {
      console.error("Failed to log event message:", eventErr);
    }

    return NextResponse.json({
      name: updated.name,
      configYaml: updated.configYaml,
      mermaidCode: updated.mermaidCode,
      iacStale: updated.iacStale,
      eventMessages,
    });
  },
);

const ACTIVE_JOB_STATUSES = new Set(["pending", "running"]);

export const DELETE = createDeleteHandler(
  {},
  async ({ userId, params }) => {
    const id = params.id!;
    const session = await getPrisma().session.findUnique({ where: { id } });
    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (
      ACTIVE_JOB_STATUSES.has(session.lastPlanStatus ?? "") ||
      ACTIVE_JOB_STATUSES.has(session.lastApplyStatus ?? "")
    ) {
      return NextResponse.json(
        { error: "Cannot delete a session with an active deploy job. Wait for it to complete first." },
        { status: 409 },
      );
    }

    await getPrisma().session.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  },
);
