-- Unified payment/status flow, notification types (confirmed 2026-09-07):
-- - module_unpaid / reaudit_unpaid / sprint_unpaid — client-facing, fired
--   when a reviewer explicitly marks something confirmed-not-paid (a real
--   gap: markModuleUnpaid()/markReaduitUnpaid() previously only touched
--   the DB, nothing told the client).
-- - sprint_requested — reviewer-facing, fired when a client creates a new
--   sprint request (either "I'll choose the finding" or "Let Elvanis
--   decide") — the sprint equivalent of module_awaiting_payment/
--   reaudit_awaiting_payment.
-- - sprint_tasks_ready_for_review — reviewer-facing, fired once payment
--   clears and the real Groq task-drafting completes — the sprint
--   equivalent of module_new_submission.
-- - module_canceled / reaudit_canceled / sprint_canceled — client-facing,
--   fired when a reviewer cancels a request, carrying the real
--   cancellation reason. Contact Sales (Concierge/Training & Advisory)
--   reuses the existing session_declined notification instead of a new
--   type — 'declined' already means this for that entity type (confirmed
--   decision: one status, not two).
alter type notification_event_type add value 'module_unpaid';
alter type notification_event_type add value 'reaudit_unpaid';
alter type notification_event_type add value 'sprint_unpaid';
alter type notification_event_type add value 'sprint_requested';
alter type notification_event_type add value 'sprint_tasks_ready_for_review';
alter type notification_event_type add value 'module_canceled';
alter type notification_event_type add value 'reaudit_canceled';
alter type notification_event_type add value 'sprint_canceled';
