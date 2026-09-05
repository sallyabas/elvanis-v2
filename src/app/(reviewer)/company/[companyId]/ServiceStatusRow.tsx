"use client";

import { useState } from "react";
import { Select } from "@/app/_components/ui/Select";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";
import { updateServiceStatusAction, addServiceStatusNoteAction } from "./actions";
import { SERVICE_STATUS_ORDER, SERVICE_STATUS_LABELS, type ServiceStatusValue, type ServiceStatusRecord } from "@/lib/reviewer/service-status-types";
import type { PaymentEntityType } from "@/lib/reviewer/payment-records";

/**
 * One unified service-status row (confirmed 2026-09-05, direct founder
 * decision, revised from two separate flows to one) — Requested -> Booked
 * -> Scheduled -> Completed -> Canceled, applied identically to every
 * service type, fixed-price or Contact Sales. Real client component
 * (unlike PaymentStatusRow's plain <form>) since the note field's
 * one-way-lock behavior genuinely needs live conditional rendering, same
 * reasoning as FrameworkRow.tsx (the Regulatory Framework Tracker's own
 * row component).
 */
export function ServiceStatusRow({
  companyId,
  entityType,
  entityId,
  defaultPrice,
  record,
}: {
  companyId: string;
  entityType: PaymentEntityType;
  entityId: string;
  /** The real, DB-backed catalog price for a fixed-price service — null for Contact Sales/free-call services, entered manually instead. */
  defaultPrice: number | null;
  record: ServiceStatusRecord | undefined;
}) {
  const [status, setStatus] = useState<ServiceStatusValue>(record?.status ?? "requested");
  const [price, setPrice] = useState(String(record?.price ?? defaultPrice ?? ""));
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteAdded, setNoteAdded] = useState(false);

  const noteLocked = record?.noteLocked ?? false;

  async function handleUpdateStatus() {
    setPending(true);
    setError(null);
    try {
      const priceValue = price.trim() === "" ? null : Number(price);
      await updateServiceStatusAction(companyId, entityType, entityId, defaultPrice, status, priceValue, "GBP");
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
      const result = await addServiceStatusNoteAction(companyId, entityType, entityId, defaultPrice, note, priceValue, "GBP");
      if (result.success) {
        setNoteAdded(true);
        setStatus("completed");
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={status} onChange={(e) => setStatus(e.target.value as ServiceStatusValue)} className="w-28 py-1 text-xs">
          {SERVICE_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {SERVICE_STATUS_LABELS[s]}
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
            placeholder="Add a note (also marks this Completed and logs a Reviewer Notes entry)"
            rows={1}
            className="w-64 py-1 text-xs"
          />
          <Button type="button" variant="secondary" disabled={pending || !note.trim()} onClick={handleAddNote} className="px-2 py-1 text-xs">
            Add note
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
