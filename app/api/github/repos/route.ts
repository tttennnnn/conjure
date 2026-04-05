export const dynamic = "force-dynamic";

import { createGetHandler } from "@/lib/api/handler";
import { listUserRepos } from "@/lib/github/client";
import { NextResponse } from "next/server";

// TODO: Returns the list of GitHub repos the user can access.
// Used by: session/new page repo picker (shown when GitHub is connected).

export const GET = createGetHandler({}, async () => {
  // TODO: Implement — call listUserRepos() and return the result.
  // Should return 403 if GitHub is not connected.
  const repos = await listUserRepos();
  return NextResponse.json(repos);
});
