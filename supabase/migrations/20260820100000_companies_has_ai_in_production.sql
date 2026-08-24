-- Real, dedicated queryable "AI in production" field (confirmed 2026-08-20,
-- direct founder decision, item 5 of the external-feedback batch) — closes
-- the gap flagged the same day: hasLiveAiInProduction previously existed
-- only inside the per-submission evidence_payload/source_evidence_snapshot
-- JSON blob (via Evidence Intake's AI & Governance step), never a queryable
-- column on the company record, and never surfaced anywhere earlier than
-- Evidence Intake.
--
-- Nullable, not `not null default false` — "not yet answered" is a real,
-- distinct state from "answered no," same discipline already applied
-- elsewhere in this codebase (kpi_unit, business_model, etc.) rather than
-- silently defaulting an unanswered question to a false negative.
--
-- Deliberately does NOT replace or touch reports.source_evidence_snapshot
-- or evidence_payload's own aiGovernance.hasLiveAiInProduction — those stay
-- exactly as they are, a frozen, historical, per-report record of what was
-- true when that specific audit ran. This new column is the CURRENT/living
-- value: it feeds Evidence Intake's own checkbox as a starting default
-- (client can still confirm/change it per submission) and is the one place
-- any future cross-company or "what's true about this company right now"
-- feature should read from. The client Report page's AI & Governance
-- callout (item 8) deliberately keeps reading the frozen per-report
-- snapshot, not this column — a delivered report's own callout should
-- reflect what the audit itself found, not whatever the company's current
-- profile says, which could drift either direction after delivery.
alter table companies add column has_ai_in_production boolean;

-- One-time backfill for already-onboarded companies (confirmed 2026-08-20)
-- — reads each company's MOST RECENT report's own frozen evidence snapshot
-- (the same source item 8's callout already trusts) so real existing
-- accounts aren't blindly null until they next touch Business Profile or
-- resubmit evidence. Companies with no report yet are correctly left null
-- (genuinely unknown, not a guess).
update companies c
set has_ai_in_production = sub.has_ai
from (
  select distinct on (r.company_id)
    r.company_id,
    (r.source_evidence_snapshot -> 'aiGovernance' ->> 'hasLiveAiInProduction')::boolean as has_ai
  from reports r
  where r.source_evidence_snapshot is not null
    and r.source_evidence_snapshot -> 'aiGovernance' ->> 'hasLiveAiInProduction' is not null
  order by r.company_id, r.submitted_at desc
) sub
where c.id = sub.company_id
  and c.has_ai_in_production is null;
