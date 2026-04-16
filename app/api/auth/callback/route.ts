import { createClient } from "@/lib/supabase/server";
import { storeGitHubToken } from "@/lib/vault/github-token";
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
      const [{ data: { user } }, { data: { session } }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      // Persist GitHub OAuth token in Vault while it's still available
      const providerToken = session?.provider_token;
      if (user?.id && typeof providerToken === "string" && providerToken.length > 0) {
        try {
          await storeGitHubToken(user.id, providerToken);
        } catch (err) {
          console.error("Failed to persist GitHub token to Vault:", err);
        }
      }

      const next = searchParams.get("next");
      if (next && isValidRedirectPath(next)) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      const isOAuth = user?.app_metadata?.provider !== "email";

      if (isOAuth) {
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
