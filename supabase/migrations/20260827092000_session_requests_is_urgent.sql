-- Urgency flag for session_requests (confirmed 2026-08-27, Onboarding
-- Architecture & Path Routing brief, Part 3 refinement) — the new
-- compliance_consultation session type needs the same "flag as urgent,
-- reviewer notified" treatment module_requests.is_urgent gives Tender
-- Readiness requests, and no equivalent existed here. Same "compute once
-- at creation, never re-derive" principle as module_requests.is_urgent.
alter table session_requests add column is_urgent boolean not null default false;

comment on column session_requests.is_urgent is
  'Stamped at creation. Currently only ever true for compliance_consultation requests created from an active triage compliance request.';
