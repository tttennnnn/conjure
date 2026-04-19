import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("signOut failed:", err);
    return new NextResponse("Sign out failed", { status: 500 });
  }
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
