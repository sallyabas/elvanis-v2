-- Real gap found while wiring the session-request confirmation email
-- (confirmed 2026-09-05) — every other "confirm a specific thing"
-- notification (report_ready/module_ready/sprint_proposed) has its own
-- related_*_id column so dispatch.ts's templateFor() can look up real
-- content (which session type, its own status) rather than write generic
-- copy. notifications had no equivalent for session_requests.
alter table notifications add column related_session_request_id uuid references session_requests(id) on delete set null;
