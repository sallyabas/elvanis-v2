-- Real Session Requests workflow (confirmed 2026-08-11, live testing pass)
-- — closes a real gap found live: declining a session request never told
-- the client anything, they'd just never hear back. None of the existing
-- notification_event_type values honestly describe "your session request
-- was declined" — same reasoning already applied for session_requested,
-- re_audit_reminder, regulatory_content_review_due.

alter type notification_event_type add value 'session_declined';
