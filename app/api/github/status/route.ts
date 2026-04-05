export const dynamic = "force-dynamic";

import { createGetHandler } from "@/lib/api/handler";
import { getGitHubStatus } from "@/lib/github/client";
import { NextResponse } from "next/server";

// TODO: Returns whether the user has a connected GitHub account.
// Used by: settings/github page (connection status) and session/new page (repo picker gate).

export const GET = createGetHandler({}, async () => {
  // TODO: Implement — call getGitHubStatus() and return the result.
  const status = await getGitHubStatus();
  return NextResponse.json(status);
});
