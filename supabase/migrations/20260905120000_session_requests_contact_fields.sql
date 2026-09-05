-- Mandatory contact fields for session requests (confirmed 2026-09-05,
-- direct founder decision — "apply the same mandatory fields retroactively
-- to all existing request types... for consistency"). phone_snapshot
-- already exists (previously optional, auto-pulled from the client's
-- profile); contact_email/contact_name are genuinely new. All three stay
-- nullable at the DB level — enforced as required at the form +
-- requestSession() layer for new submissions, since historical rows
-- (created before this migration) will never have them and shouldn't be
-- treated as corrupt data.
alter table session_requests add column contact_email text;
alter table session_requests add column contact_name text;
