-- lens_findings needs to know which report/audit cycle it belongs to.
-- company_id alone isn't enough: re-audits create new findings for the same
-- company (spec §2.3a — new evidence after delivery starts a new, distinct
-- re-audit cycle), so approveReport's "are all of THIS report's findings
-- resolved" check has no way to scope correctly without this. Nullable
-- because findings can theoretically exist before a report row does in
-- some future flow, but run-audit.ts always sets it.

alter table lens_findings
  add column report_id uuid references reports (id) on delete cascade;

create index on lens_findings (report_id);

comment on column lens_findings.report_id is
  'Which report/audit cycle this finding belongs to. company_id alone is ambiguous across re-audits.';
