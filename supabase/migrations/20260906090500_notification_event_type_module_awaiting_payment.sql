-- Module payment gate (confirmed 2026-09-06) — reviewer-facing
-- notification fired once, synchronously, the moment a module request is
-- created in 'awaiting_payment' status. Unlike reaudit_awaiting_payment
-- (fired repeatedly-but-idempotently by a cron tick discovering a due
-- row), a module request has no cron dependency at all — the admin
-- notification fires exactly once, inside the same request that creates
-- the row, so no idempotency-guard column is needed.
alter type notification_event_type add value 'module_awaiting_payment';
