-- Sixth session_type value: training_advisory (confirmed 2026-09-05,
-- direct founder decision — "reopen Training & Advisory... using the
-- exact same manual request pattern already proven for Concierge/
-- Discovery/Delivery"). Same reuse-not-reinvent precedent as
-- concierge_inquiry (2026-08-24) and compliance_consultation (2026-08-27)
-- — no payment/checkout, no calendar integration; a real request row +
-- human follow-up, "Contact Sales" framing (no price shown, no payment
-- link — unlike the five paid services this same session's own Payoneer
-- link update covers).
--
-- Still a plain text + CHECK column, not a Postgres enum (see
-- 20260806100000_service_layer_session_requests.sql's own original
-- design) — widened the same way every prior session_type addition was.
alter table session_requests drop constraint session_requests_session_type_check;
alter table session_requests add constraint session_requests_session_type_check
  check (session_type in ('discovery', 'delivery', 'f2f_workshop', 'concierge_inquiry', 'compliance_consultation', 'training_advisory'));
