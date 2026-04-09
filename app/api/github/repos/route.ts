export const dynamic = "force-dynamic";

import { createGetHandler } from "@/lib/api/handler";
import { getGitHubStatus, listUserRepos } from "@/lib/github/client";
import { NextResponse } from "next/server";

export const GET = createGetHandler({}, async () => {
  const status = await getGitHubStatus();
  if (!status.connected) {
    return NextResponse.json({ error: "GitHub is not connected" }, { status: 403 });
  }

  try {
    const repos = await listUserRepos();
    return NextResponse.json(repos);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list repositories";
    if (message === "GITHUB_NOT_CONNECTED") {
      return NextResponse.json({ error: "GitHub is not connected" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to list repositories" }, { status: 500 });
  }
});
