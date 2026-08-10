/**
 * Shared field-label definitions for the fill-in-template evidence intake
 * form (confirmed 2026-08-06) — extracted from `EvidenceIntakeForm.tsx` so
 * the client report page's "Evidence submitted" section can render the
 * same human-readable labels against `reports.source_evidence_snapshot`
 * (whose `fieldName`s are these same `key`s) without duplicating the list
 * or importing across the client/server component boundary. Framework-
 * agnostic on purpose — both a client component (the form) and a server
 * component (the report page) import from here.
 *
 * Wording pass, 2026-08-06 (honest UX review) — "runway" is startup-founder
 * jargon that a genuine first-time, non-startup-fluent user may not know,
 * so the placeholder now explains it inline rather than just reusing the
 * term; "NPS" is spelled out on first mention instead of assumed known;
 * "Activation / onboarding notes" (the label) and "first value" (the old
 * placeholder) were both product-management jargon stacked on jargon,
 * reworded to plain "get set up and start actually using it."
 */
export interface EvidenceFieldDefinition {
  key: string;
  label: string;
  placeholder: string;
}

/**
 * Real numeric metric fields (added 2026-08-07, closing a real gap found
 * live: the compareFinancialMetric()/compareExecutionMetric()/
 * compareProductMetric() deterministic-comparison machinery in
 * financial-benchmarks.ts etc. was built and tested, but the live
 * fill-in-template form never had a UI to actually collect the
 * `metrics: MetricInput[]` it runs on — `submitEvidence()` hardcoded
 * `NO_METRICS` on every real submission, so benchmark comparisons never
 * fired for a real client. `metricKey` here must exactly match the
 * `FinancialMetricKey`/`ExecutionMetricKey`/`ProductMetricKey` union each
 * lens's compare function switches on — a mismatch would silently fall
 * back to null (treated as qualitative-only), so these are deliberately
 * copied verbatim from those files, not re-derived.
 */
export interface EvidenceMetricDefinition {
  metricKey: string;
  label: string;
  unit: string;
  placeholder: string;
  /**
   * Optional plain-language clarification shown under the field (confirmed
   * 2026-08-10, real bug list from live testing) — "logo churn" is a real,
   * standard SaaS term (the % of *customers*, not revenue, lost in a
   * period — distinct from revenue churn), correct to keep rather than
   * remove, but genuinely unexplained jargon to a first-time reader. Only
   * populated where a term actually needs it, not added everywhere.
   */
  hint?: string;
}

export interface EvidenceFieldSet {
  lens: "financial" | "execution" | "product";
  title: string;
  fields: EvidenceFieldDefinition[];
  metrics: EvidenceMetricDefinition[];
}

export const EVIDENCE_FIELD_SETS: EvidenceFieldSet[] = [
  {
    lens: "financial",
    title: "Financial",
    fields: [
      { key: "revenue_margin_trends", label: "Revenue and margin trends", placeholder: "How has revenue/margin moved recently? Any notable swings?" },
      {
        key: "cash_flow_runway",
        label: "Cash flow / runway situation",
        placeholder: "How many months of cash do you have left at your current spending rate (your \"runway\")? Any cash flow concerns?",
      },
      { key: "cost_structure", label: "Cost structure notes", placeholder: "What are the biggest cost drivers? Anything creeping up?" },
      { key: "customer_concentration", label: "Customer concentration", placeholder: "Is revenue concentrated in a few large customers?" },
    ],
    metrics: [
      { metricKey: "gross_margin_percent", label: "Gross margin", unit: "%", placeholder: "e.g. 68" },
      { metricKey: "cash_runway_months", label: "Cash runway", unit: "months", placeholder: "e.g. 14" },
      { metricKey: "customer_concentration_percent", label: "Revenue from largest customer", unit: "%", placeholder: "e.g. 22" },
    ],
  },
  {
    lens: "execution",
    title: "Execution / Operating",
    fields: [
      { key: "team_delivery_process", label: "Team structure and delivery process", placeholder: "How is the team organized? What's the delivery process like?" },
      { key: "delivery_speed", label: "Recent delivery speed / delays", placeholder: "Any recent delays or slowdowns in shipping work?" },
      { key: "meeting_load", label: "Meeting load / decision-making friction", placeholder: "How much time goes to meetings? Do decisions get stuck?" },
      { key: "financial_visibility", label: "Visibility into financial data", placeholder: "How easily can the team see financial numbers day-to-day?" },
    ],
    metrics: [
      { metricKey: "delivery_lead_time_for_changes_days", label: "Delivery lead time (commit to production)", unit: "days", placeholder: "e.g. 3 — only if you track engineering delivery data" },
      { metricKey: "pr_cycle_time_hours", label: "PR / code review cycle time", unit: "hours", placeholder: "e.g. 40" },
      { metricKey: "pr_review_pickup_time_hours", label: "PR review pickup time", unit: "hours", placeholder: "e.g. 20" },
      { metricKey: "decision_approval_latency_hours", label: "Decision / approval latency", unit: "hours", placeholder: "e.g. 60 — any sign-off chain, not just engineering" },
      { metricKey: "weekly_meeting_hours_per_manager", label: "Weekly meeting hours (manager average)", unit: "hours/week", placeholder: "e.g. 11" },
    ],
  },
  {
    lens: "product",
    title: "Product / Customer",
    fields: [
      { key: "usage_adoption", label: "Usage and adoption patterns", placeholder: "How are customers actually using the product?" },
      {
        key: "satisfaction_signals",
        label: "Customer satisfaction signals",
        placeholder: "Net Promoter Score (NPS), support tickets, direct feedback — anything notable?",
      },
      { key: "churn_patterns", label: "Churn patterns", placeholder: "Who's churning and why, if known?" },
      {
        key: "activation_onboarding",
        label: "Onboarding notes",
        placeholder: "How well do new customers get set up and start actually using it?",
      },
    ],
    metrics: [
      {
        metricKey: "annual_logo_churn_percent",
        label: "Annual logo churn",
        unit: "%",
        placeholder: "e.g. 8",
        hint: "The % of customers (by count) who cancelled in the last 12 months — not revenue lost, just how many left.",
      },
      { metricKey: "nps_score", label: "Net Promoter Score (NPS)", unit: "", placeholder: "e.g. 35" },
      { metricKey: "core_feature_adoption_percent", label: "Core feature adoption", unit: "%", placeholder: "e.g. 20" },
      { metricKey: "activation_rate_percent", label: "Activation rate", unit: "%", placeholder: "e.g. 40" },
      { metricKey: "support_csat_percent", label: "Support CSAT", unit: "%", placeholder: "e.g. 80" },
    ],
  },
];
