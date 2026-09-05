-- Real gap found while wiring the contact-request reviewer notification
-- (confirmed 2026-09-05) — same "own related_*_id column so dispatch.ts
-- can look up real content" pattern as related_session_request_id.
alter table notifications add column related_contact_request_id uuid references contact_requests(id) on delete set null;
