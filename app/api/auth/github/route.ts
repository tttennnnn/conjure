import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/api/auth/callback?next=/settings/github`,
      scopes: "repo",
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/settings/github?error=oauth_failed`);
  }

  return NextResponse.redirect(data.url);
}
