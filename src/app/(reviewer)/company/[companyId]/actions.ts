"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentEntityType } from "@/lib/reviewer/payment-records";
import {
  addServiceStatusNote,
  updateContactSalesStatus,
  cancelContactSalesService,
  refundContactSalesService,
  updateContactSalesPrice,
} from "@/lib/reviewer/service-status";
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

// setPaymentRecordAction/updateServiceStatusAction both removed (confirmed
// 2026-09-08, final status-flow spec, items 4/5) — their only real callers
// (PaymentStatusRow.tsx and ServiceStatusRow.tsx) were themselves deleted,
// having become genuinely redundant with the real, automated payment-gate
// status/ContactSalesStatusRow flow. See /company/[companyId]/page.tsx's
// own top docblock for the full reasoning.

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
  if (result.success) {
    revalidatePath(`/company/${companyId}`);
    // Contact Sales rows (confirmed 2026-09-07) are now client-visible on
    // Dashboard/Reports & History too — reaching 'completed' via this
    // path (same as updateContactSalesStatusAction) needs those revalidated
    // too. A no-op extra revalidation for every other entity type, which
    // was never shown on those two pages via service_status_records.
    revalidatePath(`/dashboard`);
    revalidatePath(`/reports`);
  }
  return result;
}

/** Reviewer Notes — manual entry (confirmed 2026-09-05): "I can also manually add new entries myself, anytime." */
/**
 * relatedEntityType/relatedEntityId (confirmed 2026-09-08, item 6 of the
 * final status-flow spec) — optional; when both are present, the note is
 * scoped to that one specific request (Group 2's own per-unit "add a
 * note" mini-form is the real caller for that case) rather than general
 * (Group 3, the ReviewerNotesPanel instance with neither passed).
 */
export async function addManualReviewerNoteAction(
  companyId: string,
  name: string,
  description: string,
  entryDate: string,
  relatedEntityType?: PaymentEntityType,
  relatedEntityId?: string,
): Promise<void> {
  await assertReviewer();
  await addManualReviewerNote(companyId, name, description, entryDate, relatedEntityType, relatedEntityId);
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

/**
 * Contact Sales (Concierge/Training & Advisory) status flow (confirmed
 * 2026-09-07, final spec) — three real actions, not one generic "Update"
 * covering everything: a plain Requested/Booked/Completed status change,
 * plus two dedicated actions (Cancel/Refund) each with their own
 * reason-requirement rule, enforced by service-status.ts itself, not
 * just this thin action wrapper.
 */
export async function updateContactSalesStatusAction(
  companyId: string,
  entityId: string,
  status: "requested" | "booked" | "completed",
  price: number | null,
  currency: string,
): Promise<void> {
  await assertReviewer();
  await updateContactSalesStatus(entityId, status, price, currency);
  revalidatePath(`/company/${companyId}`);
  revalidatePath(`/dashboard`);
  revalidatePath(`/reports`);
}

export async function cancelContactSalesServiceAction(companyId: string, entityId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  await assertReviewer();
  const result = await cancelContactSalesService(entityId, reason);
  if (result.success) {
    revalidatePath(`/company/${companyId}`);
    revalidatePath(`/dashboard`);
    revalidatePath(`/reports`);
  }
  return result;
}

export async function refundContactSalesServiceAction(companyId: string, entityId: string, reason: string | null): Promise<{ success: boolean; error?: string }> {
  await assertReviewer();
  const result = await refundContactSalesService(entityId, reason);
  if (result.success) {
    revalidatePath(`/company/${companyId}`);
    revalidatePath(`/dashboard`);
    revalidatePath(`/reports`);
  }
  return result;
}

/** Price-only edit, refunded state (confirmed 2026-09-08) — see updateContactSalesPrice()'s own docblock for why this is separate from updateContactSalesStatusAction above. */
export async function updateContactSalesPriceAction(companyId: string, entityId: string, price: number | null, currency: string): Promise<{ success: boolean; error?: string }> {
  await assertReviewer();
  const result = await updateContactSalesPrice(entityId, price, currency);
  if (result.success) {
    revalidatePath(`/company/${companyId}`);
    revalidatePath(`/dashboard`);
    revalidatePath(`/reports`);
  }
  return result;
}
