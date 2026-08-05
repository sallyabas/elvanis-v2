"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Saved draft intake (confirmed 2026-08-05, pulled forward from V2 —
 * "pure UX, no data-history dependency, no reason to wait"). Session-scoped
 * throughout (RLS-respecting client, ownership enforced by the
 * `evidence_intake_drafts` policy), same discipline as every other
 * client-owned write in this codebase since real client auth landed.
 *
 * One draft row per company (unique constraint on company_id) — a simple
 * upsert target. `draftData` is an opaque JSON blob the caller defines the
 * shape of; this module doesn't know or care what's inside it, so it stays
 * reusable if another form ever wants the same save/load/clear mechanism.
 */

export interface SaveDraftResult {
  success: boolean;
  error?: string;
}

export async function saveEvidenceIntakeDraft(companyId: string, draftData: Record<string, unknown>): Promise<SaveDraftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { error } = await supabase
    .from("evidence_intake_drafts")
    .upsert({ company_id: companyId, draft_data: draftData, updated_at: new Date().toISOString() }, { onConflict: "company_id" });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function loadEvidenceIntakeDraft(companyId: string): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("evidence_intake_drafts").select("draft_data").eq("company_id", companyId).maybeSingle();
  return (data?.draft_data as Record<string, unknown> | null) ?? null;
}

export async function clearEvidenceIntakeDraft(companyId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("evidence_intake_drafts").delete().eq("company_id", companyId);
}
