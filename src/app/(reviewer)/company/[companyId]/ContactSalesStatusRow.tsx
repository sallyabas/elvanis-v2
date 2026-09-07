"use client";

import { useState } from "react";
import { Select } from "@/app/_components/ui/Select";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";
import {
  updateContactSalesStatusAction,
  addServiceStatusNoteAction,
  cancelContactSalesServiceAction,
  refundContactSalesServiceAction,
} from "./actions";
import { CONTACT_SALES_STATUS_ORDER, CONTACT_SALES_STATUS_LABELS, type ServiceStatusValue, type ServiceStatusRecord } from "@/lib/reviewer/service-status-types";

/**
 * Contact Sales (Concierge/Training & Advisory) status flow (confirmed
 * 2026-09-07, final spec, replacing the generic ServiceStatusRow for
 * these two session types specifically — every other entity type/session
 * type keeps using ServiceStatusRow.tsx unchanged).
 *
 * Deliberate divergences from ServiceStatusRow.tsx, all confirmed:
 * - Status dropdown restricted to Requested/Booked/Completed — no
 *   'Scheduled' step, and Canceled/Refunded are never reachable via this
 *   dropdown at all (only via their own dedicated actions below).
 * - Cancel is only ever shown while the record's own PERSISTED status is
 *   'requested' — never once 'booked' ("nothing in this app auto-detects
 *   payment... once Booked, Canceled is no longer available").
 * - Refund is only ever shown while the record's own PERSISTED status is
 *   'completed' ("if something needs undoing after the fact").
 * - Once the record reaches 'canceled'/'refunded', this renders as a
 *   plain, read-only terminal summary — no dropdown, no further actions,
 *   since nothing moves on from either state.
 * - Note field UX, Option A (confirmed 2026-09-07, item 5): the field
 *   starts dimmed/disabled with guiding placeholder text, and only
 *   becomes usable once the LIVE (unsaved) status dropdown selection is
 *   'completed' — one clear, sequential action (pick Completed, then
 *   write the note, then submit), not a separate write-then-validate
 *   flow. addServiceStatusNote() itself is unchanged (still
 *   unconditionally persists status:'completed' alongside the note) —
 *   this is safe precisely because the UI now guarantees the reviewer has
 *   already chosen Completed before the field is even usable.
 */
export function ContactSalesStatusRow({
  companyId,
  entityId,
  defaultPrice,
  record,
}: {
  companyId: string;
  entityId: string;
  /** The real, DB-backed catalog price (Concierge) — null for Training & Advisory, entered manually instead. */
  defaultPrice: number | null;
  record: ServiceStatusRecord | undefined;
}) {
  const persistedStatus = record?.status ?? "requested";
  const [status, setStatus] = useState<"requested" | "booked" | "completed">(
    persistedStatus === "requested" || persistedStatus === "booked" || persistedStatus === "completed" ? persistedStatus : "requested",
  );
  const [price, setPrice] = useState(String(record?.price ?? defaultPrice ?? ""));
  const [note, setNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteAdded, setNoteAdded] = useState(false);

  // Terminal state — a canceled/refunded record renders as a plain
  // summary, no controls (confirmed 2026-09-07: nothing moves on from
  // either state).
  if (persistedStatus === "canceled" || persistedStatus === "refunded") {
    return (
      <div className="mt-1 space-y-0.5">
        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{CONTACT_SALES_STATUS_LABELS[persistedStatus]}</p>
        {record?.reason && <p className="text-xs italic text-neutral-500 dark:text-neutral-400">Reason: {record.reason}</p>}
      </div>
    );
  }

  const noteLocked = record?.noteLocked ?? false;

  async function handleUpdateStatus() {
    setPending(true);
    setError(null);
    try {
      const priceValue = price.trim() === "" ? null : Number(price);
      await updateContactSalesStatusAction(companyId, entityId, status, priceValue, "GBP");
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleAddNote() {
    if (!note.trim()) return;
    setPending(true);
    setError(null);
    try {
      const priceValue = price.trim() === "" ? null : Number(price);
      const result = await addServiceStatusNoteAction(companyId, "session_request", entityId, defaultPrice, note, priceValue, "GBP");
      if (result.success) {
        setNoteAdded(true);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      setError("A cancellation reason is required.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await cancelContactSalesServiceAction(companyId, entityId, cancelReason);
      if (!result.success) setError(result.error ?? "Something went wrong.");
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleRefund() {
    setPending(true);
    setError(null);
    try {
      const result = await refundContactSalesServiceAction(companyId, entityId, refundReason || null);
      if (!result.success) setError(result.error ?? "Something went wrong.");
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={status} onChange={(e) => setStatus(e.target.value as ServiceStatusValue as "requested" | "booked" | "completed")} className="w-28 py-1 text-xs">
          {CONTACT_SALES_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {CONTACT_SALES_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="£ price" className="w-24 py-1 text-xs" />
        <Button type="button" variant="secondary" disabled={pending} onClick={handleUpdateStatus} className="px-2 py-1 text-xs">
          Update
        </Button>
      </div>

      {noteLocked || noteAdded ? (
        <p className="text-xs italic text-neutral-500 dark:text-neutral-400">
          Note: {record?.note ?? note} — logged in Reviewer Notes; edit it there, not here.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-1.5">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={status === "completed" ? "Add a note (also logs a Reviewer Notes entry)" : "Change status to Completed to add a note"}
            rows={1}
            disabled={status !== "completed"}
            className="w-64 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          />
          <Button type="button" variant="secondary" disabled={pending || status !== "completed" || !note.trim()} onClick={handleAddNote} className="px-2 py-1 text-xs">
            Add note
          </Button>
        </div>
      )}

      {/* Cancel — only while genuinely still 'requested', never once 'booked' (confirmed 2026-09-07). */}
      {persistedStatus === "requested" && (
        <div className="flex flex-wrap items-end gap-1.5">
          <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Cancellation reason (required)" className="w-64 py-1 text-xs" />
          <Button type="button" variant="secondary" disabled={pending} onClick={handleCancel} className="px-2 py-1 text-xs">
            Cancel
          </Button>
        </div>
      )}

      {/* Refund — only from 'completed' ("if something needs undoing after the fact"). Reason optional, deliberately unlike Cancel. */}
      {persistedStatus === "completed" && (
        <div className="flex flex-wrap items-end gap-1.5">
          <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Refund reason (optional)" className="w-64 py-1 text-xs" />
          <Button type="button" variant="secondary" disabled={pending} onClick={handleRefund} className="px-2 py-1 text-xs">
            Refund
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="error" className="py-1 text-xs">
          {error}
        </Alert>
      )}
    </div>
  );
}
