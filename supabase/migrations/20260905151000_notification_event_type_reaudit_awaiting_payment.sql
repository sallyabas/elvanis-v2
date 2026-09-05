-- Re-audit payment gate (confirmed 2026-09-06) — reviewer-facing (admin)
-- notification fired when a re-audit's edit window has closed but
-- payment_status is still 'pending', so the audit run is deliberately
-- withheld until a reviewer marks it paid.
alter type notification_event_type add value 'reaudit_awaiting_payment';
