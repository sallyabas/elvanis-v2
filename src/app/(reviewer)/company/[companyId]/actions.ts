"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setPaymentRecord, type PaymentEntityType, type PaymentStatusValue } from "@/lib/reviewer/payment-records";

// Same independent session+role re-check as every other reviewer Server
// Action in this codebase.
async function assertReviewer(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "reviewer") throw new Error("Not authorized as a reviewer.");
}

/**
 * Payment status (confirmed 2026-08-25, direct founder request) — one
 * shared table across every payable item, see payment-records.ts's own
 * docblock. FormData, not bound args, since this carries real
 * user-entered values (status, an optional amount/notes), not just a
 * fixed identifier.
 */
export async function setPaymentRecordAction(companyId: string, entityType: PaymentEntityType, entityId: string, formData: FormData) {
  await assertReviewer();
  const status = String(formData.get("status") ?? "not_applicable") as PaymentStatusValue;
  const amountRaw = formData.get("amount");
  const amount = amountRaw && String(amountRaw).trim() !== "" ? Number(amountRaw) : null;
  const notesRaw = formData.get("notes");
  const notes = notesRaw ? String(notesRaw).trim() || null : null;
  await setPaymentRecord(entityType, entityId, status, amount, notes);
  revalidatePath(`/company/${companyId}`);
}

/**
 * Real, reviewer-set flag (confirmed 2026-08-24) — see the migration's own
 * docblock for why this can't be auto-derived from existing data. Same
 * session+role re-check pattern as every other reviewer Server Action in
 * this codebase — the (reviewer) layout gates page rendering, but Server
 * Actions are independently reachable POST endpoints.
 */
export async function setPilotClientAction(companyId: string, isPilotClient: boolean): Promise<void> {
  await assertReviewer();
  const admin = createAdminClient();
  const { error } = await admin.from("companies").update({ is_pilot_client: isPilotClient }).eq("id", companyId);
  if (error) throw new Error(`setPilotClientAction: ${error.message}`);
  revalidatePath(`/company/${companyId}`);
}
