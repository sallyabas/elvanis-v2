"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setPaymentRecord, type PaymentEntityType, type PaymentStatusValue } from "@/lib/reviewer/payment-records";
import { updateServiceStatus, addServiceStatusNote, type ServiceStatusValue } from "@/lib/reviewer/service-status";
import { addManualReviewerNote, editReviewerNote, deleteReviewerNote } from "@/lib/reviewer/reviewer-notes";

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
 * Service status (confirmed 2026-09-05, direct founder decision) — one
 * unified flow for every service type, see service-status.ts's own
 * docblock. Plain status/price update; reaching "completed" this way
 * still triggers the real Reviewer Notes auto-entry (a service can be
 * completed with no note — "not a hard block").
 */
export async function updateServiceStatusAction(
  companyId: string,
  entityType: PaymentEntityType,
  entityId: string,
  defaultPrice: number | null,
  status: ServiceStatusValue,
  price: number | null,
  currency: string,
): Promise<void> {
  await assertReviewer();
  await updateServiceStatus(entityType, entityId, status, price, currency, defaultPrice);
  revalidatePath(`/company/${companyId}`);
}

/**
 * The note-add path (confirmed 2026-09-05) — "adding a note automatically
 * flips status to Completed as a side effect." Real, server-verified
 * one-way-editing lock — see service-status.ts's own docblock.
 */
export async function addServiceStatusNoteAction(
  companyId: string,
  entityType: PaymentEntityType,
  entityId: string,
  defaultPrice: number | null,
  note: string,
  price: number | null,
  currency: string,
): Promise<{ success: boolean; error?: string }> {
  await assertReviewer();
  const result = await addServiceStatusNote(entityType, entityId, note, price, currency, defaultPrice);
  if (result.success) revalidatePath(`/company/${companyId}`);
  return result;
}

/** Reviewer Notes — manual entry (confirmed 2026-09-05): "I can also manually add new entries myself, anytime." */
export async function addManualReviewerNoteAction(companyId: string, name: string, description: string, entryDate: string): Promise<void> {
  await assertReviewer();
  await addManualReviewerNote(companyId, name, description, entryDate);
  revalidatePath(`/company/${companyId}`);
}

/** Reviewer Notes — the one-way-editing side: edits happen here, never by re-editing the original service record. */
export async function editReviewerNoteAction(companyId: string, noteId: string, name: string, description: string, entryDate: string): Promise<void> {
  await assertReviewer();
  await editReviewerNote(noteId, name, description, entryDate);
  revalidatePath(`/company/${companyId}`);
}

export async function deleteReviewerNoteAction(companyId: string, noteId: string): Promise<void> {
  await assertReviewer();
  await deleteReviewerNote(noteId);
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
