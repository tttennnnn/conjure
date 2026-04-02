import { createClient } from "@/lib/supabase/server";
import { getPrisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import SessionView from "@/components/session/SessionView";

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

  // Narrow the Prisma Json? type to TerraformFiles shape (or null)
  const terraformCode =
    session.terraformCode &&
    typeof session.terraformCode === "object" &&
    !Array.isArray(session.terraformCode) &&
    "mainTf" in session.terraformCode
      ? (session.terraformCode as { mainTf: string; variablesTf: string; outputsTf: string })
      : null;

  return (
    <SessionView
      session={{
        id: session.id,
        name: session.name,
        targetEnv: session.targetEnv,
        iacTool: session.iacTool,
        model: session.model,
        mermaidCode: session.mermaidCode,
        configYaml: session.configYaml,
        status: session.status,
        terraformCode,
        terraformStale: session.terraformStale,
      }}
      initialMessages={session.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        createdAt: m.createdAt.toISOString(),
      }))}
    />
  );
}
