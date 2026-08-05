import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Exchanges the magic-link code for a session, then redirects. Shared by any auth flow that needs a callback — reviewer login today. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/reviewer-login`);
}
