import type { PaymentEntityType } from "@/lib/reviewer/payment-records";

/**
 * Real gap found live (confirmed 2026-09-05) — a "use server" file can
 * only export async functions; SERVICE_STATUS_ORDER/SERVICE_STATUS_LABELS
 * (and CONTACT_SALES_STATUS_ORDER/CONTACT_SALES_STATUS_LABELS below) are
 * plain values a client component needs to import directly — originally
 * ServiceStatusRow.tsx, since removed 2026-09-08 (final status-flow
 * spec); ContactSalesStatusRow.tsx is the real remaining consumer now —
 * so they live in their own, directive-free module rather than inside
 * service-status.ts.
 */
export type ServiceStatusValue = "requested" | "booked" | "scheduled" | "completed" | "canceled" | "refunded";

export const SERVICE_STATUS_ORDER: ServiceStatusValue[] = ["requested", "booked", "scheduled", "completed", "canceled"];

export const SERVICE_STATUS_LABELS: Record<ServiceStatusValue, string> = {
  requested: "Requested",
  booked: "Booked",
  scheduled: "Scheduled",
  completed: "Completed",
  canceled: "Canceled",
  refunded: "Refunded",
};

export interface ServiceStatusRecord {
  entityType: PaymentEntityType;
  entityId: string;
  status: ServiceStatusValue;
  price: number | null;
  currency: string | null;
  note: string | null;
  noteLocked: boolean;
  /** Cancel/refund reason (confirmed 2026-09-07, Contact Sales flow) — one shared field, unambiguous since `status` alone tells you which action set it. Null for every other entity type/status. */
  reason: string | null;
  requestedAt: string;
  completedAt: string | null;
}

/**
 * Contact Sales (Concierge/Training & Advisory) — simplified status flow
 * (confirmed 2026-09-07, final spec). This is the ONE, authoritative,
 * client-visible status system for these two session types specifically
 * — every other session type (Discovery/Delivery/F2F Workshop/compliance
 * consultation) keeps the existing session_requests.status-driven flow
 * (Requested/Scheduled/Completed/Declined) untouched.
 *
 * Deliberately does NOT include 'scheduled' — the confirmed flow has no
 * separate Scheduled step for these two types (collapsed into 'booked').
 * Does NOT include 'canceled'/'refunded' either — those are only ever
 * reachable via their own dedicated actions (cancelContactSalesService()/
 * refundContactSalesService()), each with its own reason-requirement
 * rule, never via the plain status dropdown — so they're intentionally
 * excluded from the set a reviewer can freely pick from.
 */
export const CONTACT_SALES_SESSION_TYPES = ["concierge_inquiry", "training_advisory"] as const;
export type ContactSalesSessionType = (typeof CONTACT_SALES_SESSION_TYPES)[number];

export function isContactSalesSessionType(sessionType: string): sessionType is ContactSalesSessionType {
  return (CONTACT_SALES_SESSION_TYPES as readonly string[]).includes(sessionType);
}

export const CONTACT_SALES_STATUS_ORDER: Extract<ServiceStatusValue, "requested" | "booked" | "completed">[] = ["requested", "booked", "completed"];

export const CONTACT_SALES_STATUS_LABELS: Record<ServiceStatusValue, string> = SERVICE_STATUS_LABELS;

/**
 * Real, fixed-price lookups per session type (confirmed 2026-09-05,
 * extracted from company/[companyId]/page.tsx on 2026-09-07 so
 * requestSession()'s own eager service_status_records creation can reuse
 * the exact same map, not a second, independently-drifting copy) — used
 * to auto-populate a Contact Sales row's price field for the one fixed-
 * price service among them (Concierge); Training & Advisory (a genuinely
 * negotiated, per-engagement Contact Sales service) correctly falls
 * through to null (manual entry).
 */
export const SESSION_TYPE_PRICING_KEY: Record<string, string> = {
  concierge_inquiry: "concierge_tier",
  f2f_workshop: "f2f_workshop",
};
