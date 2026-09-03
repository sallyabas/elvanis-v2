-- Real, profile-level phone field (confirmed 2026-09-03, direct founder
-- request) — lives on `users`, not `companies`: every session-request
-- type (Discovery/Delivery/Concierge/Training & Advisory/compliance-
-- consultation) is fundamentally "someone wants to talk to a human,"
-- matching this app's own established IA split ("Account Settings = the
-- person, Business Profile = the company being diagnosed"). Optional,
-- nullable — "not yet provided" is a real, distinct state, same
-- discipline as every other optional profile field in this codebase.
alter table users add column phone text;

-- A real snapshot on session_requests, not a live reference (confirmed
-- 2026-09-03) — "compute now, don't recompute later" against a value
-- that could change after submission, same principle already used for
-- reports.edit_window_closes_at/review_due_at. A reviewer looking back at
-- an already-submitted request should see the phone number that was on
-- file AT THE TIME the client asked to be reached, not whatever the
-- client's profile happens to say today.
alter table session_requests add column phone_snapshot text;
