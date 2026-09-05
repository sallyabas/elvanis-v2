/**
 * Shared module metadata (confirmed 2026-08-12, Dashboard/Services rebuild)
 * — one source of truth mapping a `module_type` DB value to everything the
 * UI needs: display label, the standalone entry route (genuinely different
 * spelling from the enum value — `ai_reliability` → `/ai-reliability-audit`,
 * `data_protection` → `/data-protection-compliance` — a real mismatch that
 * would otherwise get hand-copied wrong somewhere), the `pricing` table's
 * `item_key` (also a different spelling per module), and a one-line
 * client-facing description. Previously this label map was duplicated
 * ad hoc in the reviewer queue page; consolidated here so the client-facing
 * Dashboard/Services pages don't grow a third copy.
 */

export type ModuleType = "ai_reliability" | "tender_readiness" | "data_protection";

export interface ModuleMeta {
  moduleType: ModuleType;
  label: string;
  routePath: string;
  pricingKey: string;
  description: string;
  /**
   * Module-specific request-CTA text (confirmed 2026-08-31, "v2" redesign
   * bug-fix batch, item 2) — replaces the generic "Request this" on
   * Services, which read identically across all three cards with no cue
   * which module a given button actually requested until the reader looked
   * up at its own card's heading.
   */
  requestButtonLabel: string;
  /**
   * Real Payoneer payment link (confirmed 2026-09-05, direct founder
   * instruction — "confirmed against each service") — no in-app checkout
   * exists anywhere in this codebase; payment is still confirmed
   * externally/manually, same disclosed design as Execution Sprint's own
   * "a Stripe payment link, sent by the reviewer after the scope is
   * agreed." This is the same idea, just a real, always-visible link on
   * the Services page rather than something a reviewer has to remember to
   * send by hand for these three fixed-price modules.
   */
  paymentLink: string;
}

export const MODULE_META: Record<ModuleType, ModuleMeta> = {
  tender_readiness: {
    moduleType: "tender_readiness",
    label: "Tender Readiness",
    routePath: "/tender-readiness",
    pricingKey: "tender_readiness",
    description: "AI-specific regulatory risk classification and procurement-readiness content across EU AI Act, UAE DIFC, and Saudi AI governance.",
    requestButtonLabel: "Request Tender Readiness Review",
    paymentLink: "https://link.payoneer.com/Token?t=E4694A12E5F647D682D6A9EFB3599F61&src=tpl",
  },
  ai_reliability: {
    moduleType: "ai_reliability",
    label: "AI Reliability Audit",
    routePath: "/ai-reliability-audit",
    pricingKey: "ai_reliability_audit",
    description: "Adversarial testing against documented real-world AI failure patterns — invented policy, data leakage, bias, prompt injection.",
    requestButtonLabel: "Request AI Reliability Audit",
    paymentLink: "https://link.payoneer.com/Token?t=DA239AC7FF0C4A4D8A94672F574CB542&src=tpl",
  },
  data_protection: {
    moduleType: "data_protection",
    label: "Data Protection Compliance",
    routePath: "/data-protection-compliance",
    pricingKey: "data_protection_compliance",
    description: "GDPR/PDPL readiness across consent, data-subject rights, retention, breach response, and cross-border transfer.",
    requestButtonLabel: "Request Data Protection Review",
    paymentLink: "https://link.payoneer.com/Token?t=F25C11FC4D42469D8F88A7455472B66D&src=tpl",
  },
};

export const MODULE_ORDER: ModuleType[] = ["tender_readiness", "ai_reliability", "data_protection"];

/** module_requests.status reuses the same report_status enum as Core Audit reports. */
export const MODULE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  awaiting_payment: "Submitted — awaiting payment",
  pending_review: "Submitted — under review",
  approved: "Reviewed — awaiting delivery",
  sent: "Delivered",
};

/**
 * Client-facing status label, module payment gate (confirmed 2026-09-06)
 * — `status: 'awaiting_payment'` alone is ambiguous: it covers both "just
 * submitted, nothing checked yet" (payment_status 'pending' or
 * 'processing') and "a reviewer checked and it hasn't been paid"
 * (payment_status 'unpaid'), which the confirmed design requires reading
 * back as two different client-facing labels ("Submitted" vs "Unpaid").
 * `MODULE_STATUS_LABELS` alone can't express this — it's keyed on
 * `status` only — so this helper combines both fields, falling back to
 * the plain status map for every other status where payment_status is
 * irrelevant.
 */
export function moduleClientStatusLabel(status: string, paymentStatus: string | null | undefined): string {
  if (status === "awaiting_payment" && paymentStatus === "unpaid") return "Unpaid";
  return MODULE_STATUS_LABELS[status] ?? status;
}
