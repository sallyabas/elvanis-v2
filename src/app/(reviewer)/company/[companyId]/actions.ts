"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Real, reviewer-set flag (confirmed 2026-08-24) — see the migration's own
 * docblock for why this can't be auto-derived from existing data. Same
 * session+role re-check pattern as every other reviewer Server Action in
 * this codebase — the (reviewer) layout gates page rendering, but Server
 * Actions are independently reachable POST endpoints.
 */
export async function setPilotClientAction(companyId: string, isPilotClient: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "reviewer") throw new Error("Not authorized as a reviewer.");

  const admin = createAdminClient();
  const { error } = await admin.from("companies").update({ is_pilot_client: isPilotClient }).eq("id", companyId);
  if (error) throw new Error(`setPilotClientAction: ${error.message}`);
  revalidatePath(`/company/${companyId}`);
}
