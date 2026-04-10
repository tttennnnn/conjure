export const dynamic = "force-dynamic";

import { createGetHandler } from "@/lib/api/handler";
import { GitHubNotConnectedError, listUserRepos } from "@/lib/github/client";
import { NextResponse } from "next/server";

export const GET = createGetHandler({}, async () => {
  try {
    const repos = await listUserRepos();
    return NextResponse.json(repos);
  } catch (error) {
    if (error instanceof GitHubNotConnectedError) {
      return NextResponse.json({ error: "GitHub is not connected" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to list repositories" }, { status: 500 });
  }
});
