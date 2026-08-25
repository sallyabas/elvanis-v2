import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Payment records (confirmed 2026-08-25, direct founder request) — one
 * shared, polymorphic table across every payable item (module requests,
 * Execution Sprints, session requests including Concierge and F2F
 * Workshop, and paid re-audit reports), rather than a `payment_status`
 * column bolted separately onto four different tables. Same "polymorphic
 * reference validated in application code, not the DB" pattern already
 * used for `finding_feedback`. No payment gateway involved anywhere in
 * this app — this is a record of what the reviewer knows (a manual
 * Stripe link, same as Execution Sprint/Concierge already work), never
 * something that processes money itself.
 */

export type PaymentEntityType = "module_request" | "execution_sprint" | "session_request" | "report";
export type PaymentStatusValue = "not_applicable" | "unpaid" | "invoiced" | "paid";

export interface PaymentRecord {
  entityType: PaymentEntityType;
  entityId: string;
  status: PaymentStatusValue;
  amount: number | null;
  currency: string | null;
  notes: string | null;
  updatedAt: string;
}

interface PaymentRecordRow {
  entity_type: PaymentEntityType;
  entity_id: string;
  status: PaymentStatusValue;
  amount: number | null;
  currency: string | null;
  notes: string | null;
  updated_at: string;
}

function mapRow(row: PaymentRecordRow): PaymentRecord {
  return {
    entityType: row.entity_type,
    entityId: row.entity_id,
    status: row.status,
    amount: row.amount,
    currency: row.currency,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

/** Every payment record for a set of entities of ONE type, keyed by entityId — one query, not N. */
export async function loadPaymentRecords(entityType: PaymentEntityType, entityIds: string[]): Promise<Map<string, PaymentRecord>> {
  if (entityIds.length === 0) return new Map();
  const admin = createAdminClient();
  const { data, error } = await admin.from("payment_records").select("*").eq("entity_type", entityType).in("entity_id", entityIds);
  if (error) throw new Error(`loadPaymentRecords: ${error.message}`);
  return new Map((data as PaymentRecordRow[]).map((row) => [row.entity_id, mapRow(row)]));
}

/** Every payment record across every entity type, for the unified requests list. */
export async function loadAllPaymentRecords(): Promise<Map<string, PaymentRecord>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("payment_records").select("*");
  if (error) throw new Error(`loadAllPaymentRecords: ${error.message}`);
  return new Map((data as PaymentRecordRow[]).map((row) => [`${row.entity_type}:${row.entity_id}`, mapRow(row)]));
}

/** Upsert on (entity_type, entity_id) — the table's own unique constraint, so setting a status again just updates it. */
export async function setPaymentRecord(
  entityType: PaymentEntityType,
  entityId: string,
  status: PaymentStatusValue,
  amount: number | null,
  notes: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("payment_records")
    .upsert(
      { entity_type: entityType, entity_id: entityId, status, amount, notes, updated_at: new Date().toISOString() },
      { onConflict: "entity_type,entity_id" },
    );
  if (error) throw new Error(`setPaymentRecord: ${error.message}`);
}
