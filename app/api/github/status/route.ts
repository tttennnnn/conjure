export const dynamic = "force-dynamic";

import { createGetHandler } from "@/lib/api/handler";
import { getGitHubStatus } from "@/lib/github/client";
import { NextResponse } from "next/server";

export const GET = createGetHandler({}, async () => {
  const status = await getGitHubStatus();
  return NextResponse.json(status);
});
