import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Server Component / Route Handler client — respects the caller's session and RLS. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — safe to ignore when proxy.ts
            // is refreshing the session on every request (see src/proxy.ts).
          }
        },
      },
    },
  );
}
