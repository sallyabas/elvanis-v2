"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/client-login");
    router.refresh();
  }

  return (
    <button onClick={handleSignOut} className="text-sm underline">
      Sign out
    </button>
  );
}
