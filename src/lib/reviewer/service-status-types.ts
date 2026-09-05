import type { PaymentEntityType } from "@/lib/reviewer/payment-records";

/**
 * Real gap found live (confirmed 2026-09-05) — a "use server" file can
 * only export async functions; SERVICE_STATUS_ORDER/SERVICE_STATUS_LABELS
 * are plain values a client component (ServiceStatusRow.tsx) needs to
 * import directly, so they live in their own, directive-free module
 * rather than inside service-status.ts.
 */
export type ServiceStatusValue = "requested" | "booked" | "scheduled" | "completed" | "canceled";

export const SERVICE_STATUS_ORDER: ServiceStatusValue[] = ["requested", "booked", "scheduled", "completed", "canceled"];

export const SERVICE_STATUS_LABELS: Record<ServiceStatusValue, string> = {
  requested: "Requested",
  booked: "Booked",
  scheduled: "Scheduled",
  completed: "Completed",
  canceled: "Canceled",
};

export interface ServiceStatusRecord {
  entityType: PaymentEntityType;
  entityId: string;
  status: ServiceStatusValue;
  price: number | null;
  currency: string | null;
  note: string | null;
  noteLocked: boolean;
  requestedAt: string;
  completedAt: string | null;
}
