import { createClient } from "@/lib/supabase/server";
import { getPrisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import SessionView from "@/components/session/SessionView";
import type { EventKind } from "@/lib/chat/types";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { id } = await params;

  const session = await getPrisma().session.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!session || session.userId !== user.id) notFound();

  // Narrow the Prisma Json? type to IacFiles shape (or null)
  const iacCode =
    session.iacCode &&
    typeof session.iacCode === "object" &&
    !Array.isArray(session.iacCode) &&
    "mainTf" in session.iacCode
      ? (session.iacCode as { mainTf: string; variablesTf: string; outputsTf: string })
      : null;

  return (
    <SessionView
      key={session.id}
      session={{
        id: session.id,
        name: session.name,
        targetEnv: session.targetEnv,
        iacTool: session.iacTool,
        model: session.model,
        mermaidCode: session.mermaidCode,
        configYaml: session.configYaml,
        status: session.status,
        iacCode,
        iacStale: session.iacStale,
        githubRepo: session.githubRepo,
        githubBranch: session.githubBranch,
        lastPlanStatus: session.lastPlanStatus,
        lastPlanOutput: session.lastPlanOutput,
        lastApplyStatus: session.lastApplyStatus,
        lastApplyOutput: session.lastApplyOutput,
        stateBackend: (session.stateBackend as Record<string, unknown>) ?? null,
        deployJobId: session.deployJobId,
        applyJobId: session.applyJobId,
        destroyJobId: session.destroyJobId,
        lastDestroyStatus: session.lastDestroyStatus,
        lastDestroyOutput: session.lastDestroyOutput,
      }}
      initialMessages={session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt.toISOString(),
        ...(m.eventKind != null && { eventKind: m.eventKind as EventKind }),
        ...(m.diagramUpdated && { diagramUpdated: true }),
      }))}
    />
  );
}
