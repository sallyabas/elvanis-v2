import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Concierge tier assignment (confirmed 2026-08-06, spec §1.9) — closes a
 * real, previously-flagged gap: `users.plan_tier` has existed in the
 * schema since the original migration but was never wired into any UI,
 * "so 'deeper attention' is currently policy, not an enforced/visible
 * signal" (CLAUDE.md, 2026-08-02). No self-serve upgrade path exists (no
 * payment provider integrated anywhere in this codebase) — plan_tier is
 * set by a reviewer/founder, matching how the tier actually gets assigned
 * today (a real conversation with the client, not a checkout flow).
 */

export type PlanTier = "free" | "concierge";

export async function setPlanTier(userId: string, tier: PlanTier): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("users").update({ plan_tier: tier }).eq("id", userId);
  if (error) throw new Error(`setPlanTier: ${error.message}`);
}
