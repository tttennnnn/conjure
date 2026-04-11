export const dynamic = "force-dynamic";

import { createGetHandler } from "@/lib/api/handler";
import { GitHubNotConnectedError, listRepoBranchesWithTf } from "@/lib/github/client";
import { isValidGithubRepo } from "@/lib/sessions/validation";
import { NextResponse } from "next/server";

export const GET = createGetHandler({}, async ({ request }) => {
  const { searchParams } = new URL(request.url);
  const repo = searchParams.get("repo");

  if (!repo || !isValidGithubRepo(repo)) {
    return NextResponse.json(
      { error: 'repo query param is required and must be in "owner/repo" format' },
      { status: 400 },
    );
  }

  try {
    const branches = await listRepoBranchesWithTf(repo);
    return NextResponse.json(branches);
  } catch (error) {
    if (error instanceof GitHubNotConnectedError) {
      return NextResponse.json({ error: "GitHub is not connected" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to list branches" }, { status: 500 });
  }
});
