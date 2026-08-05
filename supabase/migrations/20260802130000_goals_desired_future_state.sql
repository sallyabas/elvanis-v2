-- Desired future state (confirmed 2026-08-02, spec §1.9a) — the one
-- genuinely missing piece from real gap-assessment methodology: the client
-- articulates their own "what would good look like" in their own words,
-- not just a comparison against a generic external benchmark.
--
-- Always client-provided, in all cases — regardless of whether the client
-- went through a Discovery Session or skipped straight to self-serve
-- upload. No consultant-recorded version, no dual capture path — one
-- mechanism, client-authored only. Optional; basic length/spam validation
-- only (see src/lib/goals/desired-future-state.ts) — no AI content-quality
-- check.

alter table goals
  add column desired_future_state_primary text,
  add column desired_future_state_secondary text;

comment on column goals.desired_future_state_primary is
  'Client''s own words on what "good" looks like for the primary goal — always client-authored, optional. Shown alongside the benchmark comparison in the final report; a neutral note is shown in its place when blank, never silently omitted.';
comment on column goals.desired_future_state_secondary is
  'Same as desired_future_state_primary, for the secondary goal when one is set.';
