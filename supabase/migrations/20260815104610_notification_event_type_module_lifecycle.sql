-- Real gap found and fixed 2026-08-15 (module intake/service flow review)
-- — a client submitting a standalone module request (Tender Readiness, AI
-- Reliability Audit, Data Protection Compliance) received zero real
-- notification anywhere in that request's lifecycle: no reviewer-facing
-- "new module request" notification at submission (unlike reports, which
-- fire `new_submission`), and no client-facing "your results are ready"
-- notification at delivery (unlike reports, which fire `report_ready`).
-- "Submitted for review" was purely an on-screen message with nothing
-- backing it. Two new values close both gaps, mirroring the exact
-- reviewer/client pairing reports already have.

alter type notification_event_type add value 'module_new_submission';
alter type notification_event_type add value 'module_ready';
