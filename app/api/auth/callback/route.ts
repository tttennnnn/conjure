import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const next = searchParams.get("next");
      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      // Email verification: sign out so user must log in manually
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?verified=true`);
    }
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
