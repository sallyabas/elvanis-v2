-- Contact Sales (Concierge/Training & Advisory) simplified status flow
-- (confirmed 2026-09-07, final spec after two rounds of clarification) —
-- service_status_records becomes the ONE, authoritative, client-visible
-- status system for these two service types specifically. Every other
-- entity type that uses service_status_records (reports, module requests,
-- execution sprints) is UNCHANGED by this migration — this only widens
-- the shared enum/table, it doesn't alter their existing behavior.
--
-- Real, confirmed flow for Contact Sales:
--   Requested -> Booked (reviewer confirms payment, negotiated outside
--     the app) -> Completed, OR Refunded (reachable only from Completed,
--     "if something needs undoing after the fact", reason optional).
--   Requested -> Canceled (reachable only from Requested, before Booked
--     — never once Booked, matching the AI-driven-services rule that
--     nothing is cancelable once payment is confirmed), required reason.
--   No 'Scheduled' step for these two types — the existing 'scheduled'
--     enum value stays (reports/module requests/execution sprints may
--     still use it), simply never offered as an option for Contact Sales
--     rows.
--
-- One shared `reason` column, not two separate cancellation_reason/
-- refund_reason columns — a service_status_records row is only ever in
-- exactly one of 'canceled'/'refunded' at a time, so which action set the
-- reason is always unambiguous from `status` itself; a single column
-- avoids two mostly-redundant fields.
alter type service_status_value add value 'refunded';
alter table service_status_records add column reason text;

-- Two new client-facing notification event types, mirroring the exact
-- module_canceled/reaudit_canceled/sprint_canceled pattern already built
-- (confirmed 2026-09-07) — 'refunded' is a genuinely new outcome not
-- covered by any existing event type ("Canceled" and "Refunded" are two
-- different real-world things: never happened at all, vs. happened and
-- is now being undone).
alter type notification_event_type add value 'contact_sales_canceled';
alter type notification_event_type add value 'contact_sales_refunded';
