-- Session Layer support: a session request (Discovery/Delivery/F2F Workshop)
-- needs its own notification event type — none of the existing four
-- (report_ready, new_submission, evidence_incomplete, sprint_update)
-- honestly describe "a client requested a live call," same reasoning
-- already applied twice before for this exact enum (re_audit_reminder,
-- regulatory_content_review_due).

alter type notification_event_type add value 'session_requested';
