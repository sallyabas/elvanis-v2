/**
 * Shared field-label definitions for the fill-in-template evidence intake
 * form (confirmed 2026-08-06) — extracted from `EvidenceIntakeForm.tsx` so
 * the client report page's "Evidence submitted" section can render the
 * same human-readable labels against `reports.source_evidence_snapshot`
 * (whose `fieldName`s are these same `key`s) without duplicating the list
 * or importing across the client/server component boundary. Framework-
 * agnostic on purpose — both a client component (the form) and a server
 * component (the report page) import from here.
 */
export interface EvidenceFieldDefinition {
  key: string;
  label: string;
  placeholder: string;
}

export interface EvidenceFieldSet {
  lens: "financial" | "execution" | "product";
  title: string;
  fields: EvidenceFieldDefinition[];
}

export const EVIDENCE_FIELD_SETS: EvidenceFieldSet[] = [
  {
    lens: "financial",
    title: "Financial",
    fields: [
      { key: "revenue_margin_trends", label: "Revenue and margin trends", placeholder: "How has revenue/margin moved recently? Any notable swings?" },
      { key: "cash_flow_runway", label: "Cash flow / runway situation", placeholder: "How much runway do you have? Any cash flow concerns?" },
      { key: "cost_structure", label: "Cost structure notes", placeholder: "What are the biggest cost drivers? Anything creeping up?" },
      { key: "customer_concentration", label: "Customer concentration", placeholder: "Is revenue concentrated in a few large customers?" },
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
  },
  {
    lens: "product",
    title: "Product / Customer",
    fields: [
      { key: "usage_adoption", label: "Usage and adoption patterns", placeholder: "How are customers actually using the product?" },
      { key: "satisfaction_signals", label: "Customer satisfaction signals", placeholder: "NPS, support tickets, direct feedback — anything notable?" },
      { key: "churn_patterns", label: "Churn patterns", placeholder: "Who's churning and why, if known?" },
      { key: "activation_onboarding", label: "Activation / onboarding notes", placeholder: "How well do new customers get to their first value?" },
    ],
  },
];
