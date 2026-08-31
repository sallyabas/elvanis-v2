import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Real gap found and closed (confirmed 2026-08-31, direct founder
 * investigation request): `users.name` existed on the schema from the
 * very first migration but was never captured anywhere at signup — only
 * ever set later, manually, via Account Settings. Confirmed by grepping
 * every writer of `users.name` before this: only
 * account-settings/actions.ts. Called from both onboarding minimal-
 * profile steps (Path A's OnboardingWizard, Path B's PathBWizard) once a
 * real name is entered.
 *
 * Deliberately never overwrites an existing name — same "don't clobber
 * something already set" discipline already used for
 * ensureClientUserRow()'s own role field. A client who already set their
 * name via Account Settings (or a prior onboarding pass, for a re-entry
 * scenario) keeps it; this only ever fills a genuinely blank field.
 */
export async function setUserNameIfUnset(supabase: SupabaseClient, userId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const { data: existing } = await supabase.from("users").select("name").eq("id", userId).maybeSingle();
  if (existing?.name) return;
  await supabase.from("users").update({ name: trimmed }).eq("id", userId);
}
