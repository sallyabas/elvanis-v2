-- Urgency flag for standalone module requests (confirmed 2026-08-27,
-- Onboarding Architecture & Path Routing brief, Part 3 routing matrix —
-- "flag as urgent, reviewer notified" when a client has an active
-- compliance/procurement request). No prior "urgent" concept existed
-- anywhere on module_requests.
--
-- Computed ONCE at request-creation time from that moment's triage
-- answers and stamped here, never re-derived live from companies.triage_*
-- on every read — same "compute it now, don't recompute against a
-- possibly-later-changed value" principle already used for
-- reports.edit_window_closes_at/review_due_at elsewhere in this codebase.
-- A company's triage answers could genuinely change after this request
-- was submitted; whether THIS request was urgent at submission time is a
-- fact about that moment, not something that should silently drift.
alter table module_requests add column is_urgent boolean not null default false;

comment on column module_requests.is_urgent is
  'Stamped at creation from the company''s triage_compliance_request answer at that moment (active_request -> true). Never recomputed later. Drives the reviewer queue''s urgency badge and an urgent-specific reviewer notification.';
