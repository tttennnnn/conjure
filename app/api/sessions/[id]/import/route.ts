export const dynamic = "force-dynamic";

import { createHandler } from "@/lib/api/handler";
import { getPrisma } from "@/lib/prisma";
import { resolveModelId } from "@/lib/sessions/validation";
import { resolveApiKey } from "@/lib/api/resolve-key";
import { createRateLimiter } from "@/lib/rate-limit";
import { listTfFiles, getFileContent, GitHubNotConnectedError } from "@/lib/github/client";
import { importFromHcl } from "@/lib/llm/import";
import { NextResponse } from "next/server";

const importLimiter = createRateLimiter("import-from-repo", { maxRequests: 5, windowMs: 60_000 });

const MAX_TF_FILES = 20;
const MAX_HCL_CHARS = 100_000; // ~100 KB — guard against enormous repos

export const POST = createHandler<Record<string, never>>(
  { rateLimit: importLimiter },
  async ({ userId, params }) => {
    const { id: sessionId } = params;

    const session = await getPrisma().session.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (!session.githubRepo || !session.githubBranch) {
      return NextResponse.json(
        { error: "Session has no linked GitHub repo or branch" },
        { status: 400 },
      );
    }

    if (session.mermaidCode?.trim()) {
      return NextResponse.json(
        { error: "Session already has a diagram — clear it before re-importing" },
        { status: 409 },
      );
    }

    const resolved = resolveModelId(session.model);
    if (!resolved) {
      return NextResponse.json({ error: "Invalid model configuration" }, { status: 400 });
    }

    const keyResult = await resolveApiKey(userId, resolved.provider);
    if ("error" in keyResult) {
      return NextResponse.json({ error: keyResult.error }, { status: keyResult.status });
    }

    // Fetch .tf file paths from the branch
    let tfPaths: string[];
    try {
      tfPaths = await listTfFiles(session.githubRepo, session.githubBranch);
    } catch (err) {
      if (err instanceof GitHubNotConnectedError) {
        return NextResponse.json({ error: "GitHub is not connected" }, { status: 403 });
      }
      const msg = err instanceof Error ? err.message : "Failed to list .tf files";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    if (tfPaths.length === 0) {
      return NextResponse.json(
        { error: "No .tf files found in this branch" },
        { status: 400 },
      );
    }

    // Fail closed: if there are more files than the cap, reject rather than silently importing a subset.
    if (tfPaths.length > MAX_TF_FILES) {
      return NextResponse.json(
        {
          error: `This branch has ${tfPaths.length} Terraform files — import supports up to ${MAX_TF_FILES}. Scope your repo to a single module or reduce the number of .tf files.`,
        },
        { status: 400 },
      );
    }

    // Fetch all file contents in batches of 5 — fail closed on any fetch error.
    const BATCH_SIZE = 5;
    const fileContents: { path: string; content: string }[] = [];

    for (let i = 0; i < tfPaths.length; i += BATCH_SIZE) {
      const batch = tfPaths.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((filePath) =>
          getFileContent(session.githubRepo!, session.githubBranch!, filePath)
            .then((content) => ({ path: filePath, content })),
        ),
      ).catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to read .tf files";
        return Promise.reject(new Error(msg));
      });
      fileContents.push(...results);
    }

    // Fail closed: if combined HCL exceeds the size cap the import would be incomplete.
    let hclContent = "";
    for (const { path, content } of fileContents) {
      const block = `// --- ${path} ---\n${content}\n\n`;
      if (hclContent.length + block.length > MAX_HCL_CHARS) {
        return NextResponse.json(
          {
            error: `Combined Terraform content exceeds the ${MAX_HCL_CHARS / 1000} KB import limit. Scope your repo to a single module.`,
          },
          { status: 400 },
        );
      }
      hclContent += block;
    }

    // Call LLM to reverse-engineer Mermaid + Config from HCL
    let importResult: { mermaidCode: string; configYaml: string };
    try {
      importResult = await importFromHcl({
        hclContent,
        targetEnv: session.targetEnv,
        iacTool: session.iacTool,
        provider: resolved.provider,
        modelId: resolved.modelId,
        apiKey: keyResult.apiKey,
        disableReasoning: resolved.disableReasoning,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      return NextResponse.json({ error: msg }, { status: 422 });
    }

    // Persist the imported Mermaid + Config to the session.
    // Use optimistic concurrency: only write if the session hasn't been modified since we read it.
    // This prevents import from clobbering edits the user made in another tab while the LLM was running.
    const updated = await getPrisma().session.updateMany({
      where: { id: sessionId, updatedAt: session.updatedAt },
      data: {
        mermaidCode: importResult.mermaidCode,
        configYaml: importResult.configYaml,
        iacStale: false,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Session was modified while import was running — please try again" },
        { status: 409 },
      );
    }

    return NextResponse.json({
      mermaidCode: importResult.mermaidCode,
      configYaml: importResult.configYaml,
      filesImported: fileContents.length,
    });
  },
);
