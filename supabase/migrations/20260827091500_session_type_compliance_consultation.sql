-- Fifth session_type value: compliance_consultation (confirmed 2026-08-27,
-- Onboarding Architecture & Path Routing brief, Part 3 refinement) — the
-- founder's own confirmed decision: "route to human consultation" (when
-- triage Q2 = active_request, regardless of Q1's AI-usage answer,
-- including companies with no AI at all yet) reuses the existing
-- session-request mechanism with a new session_type, same pattern as
-- concierge_inquiry, rather than inventing a new mechanism.
--
-- Still a plain text + CHECK column, not a Postgres enum (see
-- 20260806100000_service_layer_session_requests.sql's own original
-- design) — widened the same way concierge_inquiry was.
alter table session_requests drop constraint session_requests_session_type_check;
alter table session_requests add constraint session_requests_session_type_check
  check (session_type in ('discovery', 'delivery', 'f2f_workshop', 'concierge_inquiry', 'compliance_consultation'));
