-- Real gap fixed (confirmed 2026-08-12, direct founder request): the
-- client-facing "Interested in help implementing this?" button was a
-- single ambiguous action with no real choice — clicking it always meant
-- "yes." Adds a real, explicit response so a client can say yes, not now,
-- or leave a free-text note instead, distinct from the "have they
-- responded at all" status column (status stays 'open'/'resolved',
-- reviewer-side triage; response is what the client actually said).
alter table sprint_interest_requests
  add column response text check (response in ('interested', 'not_now', 'other'));
