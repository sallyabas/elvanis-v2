-- Real, confirmed bug fix, 2026-09-02 — found incidentally while building/
-- running the new Playwright E2E suite (tests/e2e/), not a speculative
-- hardening pass. Reproducible React "Encountered two children with the
-- same key" warnings on the Reviewer Workspace's "Similar patterns across
-- other companies" section (ReviewWorkspaceClient.tsx, keyed by
-- `p.reportId`) traced to genuine, real duplicate rows in `case_library` —
-- confirmed by direct query against the live dev DB: two report_ids each
-- had exactly two rows with identical company_id/tags, most likely from
-- `recordCaseLibraryEntry()` (called from `deliverReport()`) having been
-- invoked more than once against the same already-delivered report during
-- this project's own extensive live-verification history.
--
-- `case_library.report_id` was `not null` but never had a uniqueness
-- constraint, so nothing prevented this. Fixed at the strongest layer, the
-- schema itself, not just the one call site that happened to surface it —
-- same "add a deterministic backstop, don't just patch the symptom"
-- discipline already used throughout this codebase for every other
-- "an assumption turned out not to hold" bug.
--
-- Dedupe existing rows first (keep the earliest-inserted row per
-- report_id, arbitrary but deterministic tie-break since the observed
-- duplicates carry identical tags/company_id — nothing meaningful is lost
-- by keeping either one) — the unique constraint below would otherwise
-- fail to apply against real, already-duplicated data.
delete from case_library a
using case_library b
where a.report_id = b.report_id
  and a.id > b.id;

alter table case_library
  add constraint case_library_report_id_key unique (report_id);
