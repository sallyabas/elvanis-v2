"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentEntityType } from "@/lib/reviewer/payment-records";
import { TYPE_LABELS, moduleTypeToItemType, sessionTypeToItemType } from "@/lib/item-type-badge";
import { addServiceStatusReviewerNote } from "@/lib/reviewer/reviewer-notes";
import type { ServiceStatusValue, ServiceStatusRecord } from "@/lib/reviewer/service-status-types";

/**
 * Service status (confirmed 2026-09-05, direct founder decision, revised
 * to one unified flow for every service type). See
 * service_status_records' own migration docblock for the full schema
 * reasoning — reuses PaymentEntityType (payment_records' own enum) rather
 * than a duplicate, since the same 4 entity kinds apply here.
 *
 * ServiceStatusValue/ServiceStatusRecord/SERVICE_STATUS_ORDER/
 * SERVICE_STATUS_LABELS moved to service-status-types.ts (confirmed
 * 2026-09-05, real bug found live) — a "use server" file can only export
 * async functions; plain values a client component needs directly can't
 * live here.
 */
export type { ServiceStatusValue, ServiceStatusRecord } from "@/lib/reviewer/service-status-types";

interface ServiceStatusRow {
  entity_type: PaymentEntityType;
  entity_id: string;
  status: ServiceStatusValue;
  price: number | null;
  currency: string | null;
  note: string | null;
  note_locked_at: string | null;
  /** Cancel/refund reason (confirmed 2026-09-07, Contact Sales flow) — see service-status-types.ts's own docblock. */
  reason: string | null;
  requested_at: string;
  completed_at: string | null;
}

function mapRow(row: ServiceStatusRow): ServiceStatusRecord {
  return {
    entityType: row.entity_type,
    entityId: row.entity_id,
    status: row.status,
    price: row.price,
    currency: row.currency,
    note: row.note,
    noteLocked: row.note_locked_at !== null,
    reason: row.reason ?? null,
    requestedAt: row.requested_at,
    completedAt: row.completed_at,
  };
}

/**
 * Resolves the real display label + owning company + the entity's own
 * real creation moment (confirmed 2026-09-05) — used both for the
 * "Discovery Session — completed"-style Reviewer Notes label and for
 * lazily backfilling a genuinely honest requestedAt the first time a
 * service_status_records row is created for this entity, rather than
 * "whenever a reviewer happened to first look at this row."
 */
async function resolveEntityContext(
  entityType: PaymentEntityType,
  entityId: string,
): Promise<{ label: string; companyId: string; createdAt: string } | null> {
  const admin = createAdminClient();
  if (entityType === "module_request") {
    const { data } = await admin.from("module_requests").select("company_id, module_type, created_at").eq("id", entityId).maybeSingle();
    if (!data) return null;
    return { label: TYPE_LABELS[moduleTypeToItemType(data.module_type as string)], companyId: data.company_id as string, createdAt: data.created_at as string };
  }
  if (entityType === "session_request") {
    const { data } = await admin.from("session_requests").select("company_id, session_type, requested_at").eq("id", entityId).maybeSingle();
    if (!data) return null;
    return { label: TYPE_LABELS[sessionTypeToItemType(data.session_type as string)], companyId: data.company_id as string, createdAt: data.requested_at as string };
  }
  if (entityType === "execution_sprint") {
    const { data } = await admin.from("execution_sprints").select("company_id, created_at").eq("id", entityId).maybeSingle();
    if (!data) return null;
    return { label: "Execution Sprint", companyId: data.company_id as string, createdAt: data.created_at as string };
  }
  // "report" — only ever a paid re-audit here (payment_records' own established scope).
  const { data } = await admin.from("reports").select("company_id, submitted_at, created_at").eq("id", entityId).maybeSingle();
  if (!data) return null;
  return { label: "Core Audit", companyId: data.company_id as string, createdAt: (data.submitted_at as string | null) ?? (data.created_at as string) };
}

/** Every service-status record for a set of entities of ONE type, keyed by entityId — one query, not N. Does NOT lazily create missing rows (that's getOrCreateServiceStatusRecord's job, used only when a reviewer actually acts on one). */
export async function loadServiceStatusRecords(entityType: PaymentEntityType, entityIds: string[]): Promise<Map<string, ServiceStatusRecord>> {
  if (entityIds.length === 0) return new Map();
  const admin = createAdminClient();
  const { data, error } = await admin.from("service_status_records").select("*").eq("entity_type", entityType).in("entity_id", entityIds);
  if (error) throw new Error(`loadServiceStatusRecords: ${error.message}`);
  return new Map((data as ServiceStatusRow[]).map((row) => [row.entity_id, mapRow(row)]));
}

/** Fixed-price auto-population (confirmed 2026-09-05) — the caller passes the real DB-backed catalog price (from listPricing()) when one exists; Contact Sales services (Training & Advisory, Concierge) get null here and are entered manually. */
async function getOrCreateServiceStatusRecord(
  entityType: PaymentEntityType,
  entityId: string,
  defaultPrice: number | null,
  defaultCurrency: string,
): Promise<ServiceStatusRecord> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("service_status_records").select("*").eq("entity_type", entityType).eq("entity_id", entityId).maybeSingle();
  if (existing) return mapRow(existing as ServiceStatusRow);

  const context = await resolveEntityContext(entityType, entityId);
  const requestedAt = context?.createdAt ?? new Date().toISOString();

  const { data: created, error } = await admin
    .from("service_status_records")
    .insert({ entity_type: entityType, entity_id: entityId, status: "requested", price: defaultPrice, currency: defaultCurrency, requested_at: requestedAt })
    .select("*")
    .single();
  if (error) throw new Error(`getOrCreateServiceStatusRecord: ${error.message}`);
  return mapRow(created as ServiceStatusRow);
}

/**
 * Plain status/price update (confirmed 2026-09-05) — no note involved.
 * "A service can be marked Completed without ever adding a note — not a
 * hard block," so reaching 'completed' THIS way still triggers the real
 * Reviewer Notes auto-entry (per the confirmed design: "Auto-entry
 * triggers on the session/service reaching Completed status," not only
 * when a note happens to exist) — Description is an honest "(no note
 * added)" placeholder in that case, never fabricated content.
 */
export async function updateServiceStatus(
  entityType: PaymentEntityType,
  entityId: string,
  status: ServiceStatusValue,
  price: number | null,
  currency: string,
  defaultPrice: number | null = null,
): Promise<void> {
  const admin = createAdminClient();
  const existing = await getOrCreateServiceStatusRecord(entityType, entityId, defaultPrice, currency);
  const isNewlyCompleted = status === "completed" && existing.status !== "completed";

  const update: Record<string, unknown> = { status, price, currency, updated_at: new Date().toISOString() };
  if (isNewlyCompleted) update.completed_at = new Date().toISOString();

  const { error } = await admin.from("service_status_records").update(update).eq("entity_type", entityType).eq("entity_id", entityId);
  if (error) throw new Error(`updateServiceStatus: ${error.message}`);

  if (isNewlyCompleted) {
    const context = await resolveEntityContext(entityType, entityId);
    if (context) {
      await addServiceStatusReviewerNote(
        context.companyId,
        `${context.label} — completed`,
        existing.note ?? "(no note added)",
        (update.completed_at as string) ?? new Date().toISOString(),
      );
    }
  }
}

/**
 * The note-add path (confirmed 2026-09-05) — "adding a note automatically
 * flips status to Completed as a side effect, it isn't a separate manual
 * step." Real, disclosed one-way-editing enforcement: once a note here
 * has fed a Reviewer Notes entry (note_locked_at set), this function
 * refuses any further write — the caller's own UI should already hide
 * the input once locked, this is the real server-side guarantee behind
 * that, same "validate at the boundary too" discipline as every other
 * mandatory rule in this codebase.
 */
export async function addServiceStatusNote(
  entityType: PaymentEntityType,
  entityId: string,
  note: string,
  price: number | null,
  currency: string,
  defaultPrice: number | null = null,
): Promise<{ success: boolean; error?: string }> {
  const existing = await getOrCreateServiceStatusRecord(entityType, entityId, defaultPrice, currency);
  if (existing.noteLocked) {
    return { success: false, error: "This note is locked — edit it in Reviewer Notes instead." };
  }

  const admin = createAdminClient();
  const completedAt = new Date().toISOString();
  const { error } = await admin
    .from("service_status_records")
    .update({ status: "completed", note: note.trim(), note_locked_at: completedAt, completed_at: completedAt, price, currency, updated_at: completedAt })
    .eq("entity_type", entityType)
    .eq("entity_id", entityId);
  if (error) return { success: false, error: error.message };

  const context = await resolveEntityContext(entityType, entityId);
  if (context) {
    await addServiceStatusReviewerNote(context.companyId, `${context.label} — completed`, note.trim(), completedAt);
  }

  return { success: true };
}

/**
 * Contact Sales (Concierge/Training & Advisory) — simplified status flow
 * (confirmed 2026-09-07, final spec). All three functions below are only
 * ever called with `entityType: "session_request"` for a
 * concierge_inquiry/training_advisory row — every other entity type/
 * session type keeps using updateServiceStatus()/addServiceStatusNote()
 * above, unchanged.
 */
export interface ContactSalesActionResult {
  success: boolean;
  error?: string;
}

/** Loads the company/owning-user for a session_requests row — the real recipient for the two new client-facing notifications below. */
async function loadSessionRequestOwner(entityId: string): Promise<{ companyId: string; userId: string | null } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("session_requests").select("company_id, companies(user_id)").eq("id", entityId).maybeSingle();
  if (!data) return null;
  const owner = data.companies as unknown as { user_id: string } | null;
  return { companyId: data.company_id as string, userId: owner?.user_id ?? null };
}

/**
 * Plain status update, restricted to Requested/Booked/Completed
 * (confirmed 2026-09-07) — the Contact Sales equivalent of
 * updateServiceStatus() above, but never accepts 'scheduled'/'canceled'/
 * 'refunded' (those two are only ever reachable via their own dedicated
 * actions below, each with its own reason-requirement rule). Reaching
 * 'completed' this way still triggers the same real Reviewer Notes
 * auto-entry as the generic path — "a service can be completed without a
 * note" stays true here too.
 */
export async function updateContactSalesStatus(
  entityId: string,
  status: "requested" | "booked" | "completed",
  price: number | null,
  currency: string,
): Promise<void> {
  await updateServiceStatus("session_request", entityId, status, price, currency);
}

/**
 * Cancel — only reachable from 'requested', never once Booked (confirmed
 * 2026-09-07: "nothing in this app auto-detects payment... once Booked,
 * Canceled is no longer available" — the same rule as the AI-driven
 * services' pre-payment-only cancellation gate, applied here with
 * 'requested' standing in for their 'awaiting_payment'). A required
 * reason, same discipline as cancelModuleRequest()/cancelSprintRequest()/
 * cancelReaudit(), and a real client-facing email.
 */
export async function cancelContactSalesService(entityId: string, reason: string): Promise<ContactSalesActionResult> {
  if (!reason.trim()) return { success: false, error: "A cancellation reason is required." };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("service_status_records")
    .update({ status: "canceled", reason: reason.trim(), updated_at: new Date().toISOString() })
    .eq("entity_type", "session_request")
    .eq("entity_id", entityId)
    .eq("status", "requested")
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "This request has already moved past 'Requested' — it can no longer be canceled." };

  const owner = await loadSessionRequestOwner(entityId);
  if (owner?.userId) {
    const { error: notifError } = await admin.from("notifications").insert({
      recipient_type: "client",
      recipient_id: owner.userId,
      event_type: "contact_sales_canceled",
      channel: "email",
      related_session_request_id: entityId,
      sent_at: null,
    });
    if (notifError) throw new Error(`cancelContactSalesService: failed to log notification: ${notifError.message}`);
  }

  return { success: true };
}

/**
 * Refund — only reachable from 'completed' ("if something needs undoing
 * after the fact", confirmed 2026-09-07). Reason is optional here,
 * deliberately unlike Cancel — a real, confirmed difference: something
 * that already happened and is being unwound doesn't always need a
 * documented reason the way declining upfront does. A real client-facing
 * email fires either way.
 */
export async function refundContactSalesService(entityId: string, reason: string | null): Promise<ContactSalesActionResult> {
  const admin = createAdminClient();
  const trimmedReason = reason?.trim() || null;
  const { data, error } = await admin
    .from("service_status_records")
    .update({ status: "refunded", reason: trimmedReason, updated_at: new Date().toISOString() })
    .eq("entity_type", "session_request")
    .eq("entity_id", entityId)
    .eq("status", "completed")
    .select("id")
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "This request isn't at 'Completed' right now — it can only be refunded from there." };

  const owner = await loadSessionRequestOwner(entityId);
  if (owner?.userId) {
    const { error: notifError } = await admin.from("notifications").insert({
      recipient_type: "client",
      recipient_id: owner.userId,
      event_type: "contact_sales_refunded",
      channel: "email",
      related_session_request_id: entityId,
      sent_at: null,
    });
    if (notifError) throw new Error(`refundContactSalesService: failed to log notification: ${notifError.message}`);
  }

  return { success: true };
}

/**
 * Eager creation at request time (confirmed 2026-09-07, replaces the
 * generic lazy get-or-create for Contact Sales specifically) — called
 * directly from requestSession() right after the real session_requests
 * insert, so a client sees a real, genuine status from the moment they
 * submit, not "nothing" until a reviewer first happens to touch the row.
 * Thin wrapper around the existing generic getOrCreateServiceStatusRecord
 * — exported since that function itself isn't (this file's own module
 * boundary), and this is the one legitimate external caller that needs
 * to trigger creation without also updating anything.
 */
export async function ensureContactSalesStatusRecord(entityId: string, defaultPrice: number | null): Promise<void> {
  await getOrCreateServiceStatusRecord("session_request", entityId, defaultPrice, "GBP");
}
