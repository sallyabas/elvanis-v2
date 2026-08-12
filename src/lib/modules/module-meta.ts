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
}

export const MODULE_META: Record<ModuleType, ModuleMeta> = {
  tender_readiness: {
    moduleType: "tender_readiness",
    label: "Tender Readiness",
    routePath: "/tender-readiness",
    pricingKey: "tender_readiness",
    description: "AI-specific regulatory risk classification and procurement-readiness content across EU AI Act, UAE DIFC, and Saudi AI governance.",
  },
  ai_reliability: {
    moduleType: "ai_reliability",
    label: "AI Reliability Audit",
    routePath: "/ai-reliability-audit",
    pricingKey: "ai_reliability_audit",
    description: "Adversarial testing against documented real-world AI failure patterns — invented policy, data leakage, bias, prompt injection.",
  },
  data_protection: {
    moduleType: "data_protection",
    label: "Data Protection Compliance",
    routePath: "/data-protection-compliance",
    pricingKey: "data_protection_compliance",
    description: "GDPR/PDPL readiness across consent, data-subject rights, retention, breach response, and cross-border transfer.",
  },
};

export const MODULE_ORDER: ModuleType[] = ["tender_readiness", "ai_reliability", "data_protection"];

/** module_requests.status reuses the same report_status enum as Core Audit reports. */
export const MODULE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Submitted — under review",
  approved: "Reviewed — awaiting delivery",
  sent: "Delivered",
};
