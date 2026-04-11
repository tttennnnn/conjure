import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function isValidRedirectPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const next = searchParams.get("next");
      if (next && isValidRedirectPath(next)) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      const isOAuth = user?.app_metadata?.provider !== "email";

      if (isOAuth) {
        // GitHub OAuth sign-in/register: user is already authenticated
        return NextResponse.redirect(`${origin}/home`);
      }

      // Email verification: sign out so user must log in manually
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?verified=true`);
    }
  }

  // Auth failed -- redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
