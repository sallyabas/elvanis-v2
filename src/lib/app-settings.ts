import { createAdminClient } from "@/lib/supabase/admin";

/** Admin-adjustable operational thresholds (confirmed 2026-08-02) — see app_settings table. No admin UI yet; edit via direct SQL. */
export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  return typeof data?.value === "number" ? data.value : fallback;
}
