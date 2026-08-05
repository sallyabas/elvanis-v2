"use server";

import { createClient } from "@/lib/supabase/server";
import { validateDesiredFutureState } from "./validation";

/**
 * "In your own words, what would good look like here?" (spec §1.9a,
 * confirmed 2026-08-02) — always client-authored, optional, one mechanism
 * only (no consultant-recorded version).
 *
 * Real client auth now exists (confirmed 2026-08-03) — switched from the
 * service-role client to the session-scoped one (confirmed 2026-08-04,
 * Priority 3), closing the known, time-boxed gap flagged when this was
 * first built. Ownership is enforced by `goals`' existing "owner reads own
 * goals" RLS policy (`for all using (company_id in (select id from
 * companies where user_id = auth.uid()))`) — an update for a goal the
 * caller doesn't own simply matches zero rows, not an error, same as any
 * other RLS-scoped write in this app.
 */

export interface UpdateDesiredFutureStateResult {
  success: boolean;
  error?: string;
}

export async function updateDesiredFutureState(
  goalId: string,
  field: "primary" | "secondary",
  value: string,
): Promise<UpdateDesiredFutureStateResult> {
  const validation = validateDesiredFutureState(value);
  if (!validation.valid) return { success: false, error: validation.error };

  const column = field === "primary" ? "desired_future_state_primary" : "desired_future_state_secondary";
  const trimmed = value.trim();

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ [column]: trimmed.length > 0 ? trimmed : null })
    .eq("id", goalId);

  if (error) return { success: false, error: "Couldn't save — try again." };
  return { success: true };
}
