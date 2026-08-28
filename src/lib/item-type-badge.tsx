/**
 * Shared item-type badge system (extracted 2026-08-26, navigation-audit
 * fix batch, item 3) — originally built for `(app)/reports/page.tsx`'s
 * full redesign (see that file's own docblock for the research behind the
 * "colored badge per type" decision). The full UX validation pass found
 * the exact same "flat, undifferentiated item types" gap recurring on
 * `/queue`, `/requests`, `/signals`, and `/company/[companyId]` —
 * extracted here so every one of those pages (plus Reports & History
 * itself) reads from the same single source of truth instead of each
 * re-inventing its own label/color map.
 *
 * Deliberately does NOT cover the 5 audit *lenses* (financial/execution/
 * product/commercial/ai_governance) — those are a genuinely different
 * dimension (which part of one Core Audit a finding came from, not which
 * deliverable/request this is) and only ever shown together in one place
 * (Signals' "Source" filter) — Signals defines its own small lens-color
 * map locally for that reason, reusing this module only for its 3 module
 * types, which ARE the same identity as everywhere else.
 */

export type ItemType =
  | "core_audit"
  | "tender_readiness"
  | "ai_reliability"
  | "data_protection"
  | "execution_sprint"
  | "discovery"
  | "delivery"
  | "f2f_workshop"
  | "concierge"
  | "compliance_consultation";

export const TYPE_LABELS: Record<ItemType, string> = {
  core_audit: "Core Audit",
  tender_readiness: "Tender Readiness",
  ai_reliability: "AI Reliability Audit",
  data_protection: "Data Protection Compliance",
  execution_sprint: "Execution Sprint",
  discovery: "Discovery Session",
  delivery: "Delivery Session",
  f2f_workshop: "F2F Workshop",
  concierge: "Concierge Inquiry",
  // Added 2026-08-27, Onboarding Architecture & Path Routing brief, Part 3
  // refinement — the "route to human consultation" session type.
  compliance_consultation: "Compliance Consultation",
};

// One distinct color per type, so a reviewer or client can tell items
// apart by glancing at the badge alone, not just by reading the label.
// Core Audit gets the real brand accent token (this app's own established
// "primary/flagship" signal) — deliberately NOT the same tone Signals/
// Dashboard use for "medium severity", so the two unrelated meanings never
// read as the same color. Every other type gets a genuinely distinct hue,
// avoiding red/orange (reserved for severity elsewhere in this app).
//
// Softened 2026-08-28 (premium B2B redesign) — a UI pattern the spec's 10
// points don't name directly (severity badges specifically), so the same
// "soft-tone wash reads as professional, not alarming" principle was
// applied by extension: every -100/-800 pairing became -50/-700, matching
// the new severity badges' restrained tone instead of the previous
// saturated look.
export const TYPE_BADGE_STYLES: Record<ItemType, string> = {
  core_audit: "bg-accent text-accent-ink",
  tender_readiness: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  ai_reliability: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  data_protection: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  execution_sprint: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  discovery: "bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  delivery: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  f2f_workshop: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  concierge: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  // Deliberate exception to the "avoid red, reserved for severity" rule
  // above — every compliance_consultation request is, by construction,
  // created only from an active/urgent triage answer (see
  // path-b-routing.ts), so red here is the same "genuinely urgent" signal
  // as the OVERDUE badge elsewhere, not a collision with severity.
  compliance_consultation: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300",
};

export function TypeBadge({ type, className = "" }: { type: ItemType; className?: string }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_STYLES[type]} ${className}`}>{TYPE_LABELS[type]}</span>;
}

/** Maps a real `module_requests.module_type` DB value to its badge identity. */
export function moduleTypeToItemType(moduleType: string): ItemType {
  if (moduleType === "ai_reliability") return "ai_reliability";
  if (moduleType === "tender_readiness") return "tender_readiness";
  return "data_protection";
}

/** Maps a real `session_requests.session_type` DB value to its badge identity. */
export function sessionTypeToItemType(sessionType: string): ItemType {
  if (sessionType === "discovery") return "discovery";
  if (sessionType === "delivery") return "delivery";
  if (sessionType === "concierge_inquiry") return "concierge";
  if (sessionType === "compliance_consultation") return "compliance_consultation";
  return "f2f_workshop";
}
