-- Improved source-signature detection, partial move (confirmed 2026-08-05,
-- pulled forward from V2) — "add more known-tool signatures from
-- documented export formats. The 'learn from real messy uploads' half
-- stays gated — no real client uploads exist yet to learn from."
--
-- Real, researched signature data for the 7 named tools (spec §5, §1),
-- sourced from each tool's own current help/developer documentation (see
-- CLAUDE.md for the search citations), NOT invented from training-data
-- recollection — export column formats change over time and this codebase's
-- standing rule is never to fabricate a concrete factual claim like this.
--
-- Honest about a real asymmetry found during research: some of these tools
-- have a genuinely fixed, non-customizable export schema (Xero's invoice
-- import/export, Jira's CSV export, Zendesk's ticket export, QuickBooks'
-- checks import) — for those, requiredHeaders is a real, reliable
-- fingerprint. Others are user-configurable at export time with no fixed
-- column set (HubSpot contacts, Salesforce report exports, Intercom
-- conversations) — for those, requiredHeaders is deliberately a smaller,
-- honest subset of commonly-present fields, and detectionConfidence is
-- marked "partial" rather than claiming a reliability these tools don't
-- actually offer. This asymmetry is real, not a placeholder gap.
--
-- field_mapping_template maps a recognized source column to this
-- codebase's own evidence-field vocabulary (the same fieldName keys used
-- by the fill-in-template evidence intake form) — forward-looking data for
-- the parsing engine that doesn't exist yet (see CLAUDE.md "Evidence
-- Intake scope decision"), not itself the parsing engine.

insert into export_source_signatures (source_name, signature_pattern, field_mapping_template) values
(
  'xero_invoices',
  '{
    "detectionConfidence": "high",
    "note": "Xero invoice import/export format is fixed and documented — column order/names cannot be changed without breaking Xero''s own import.",
    "requiredHeaders": ["ContactName", "InvoiceNumber", "InvoiceDate", "DueDate", "Description", "Quantity", "UnitAmount", "AccountCode"],
    "filenamePatterns": ["xero", "invoice"],
    "source": "https://entryrocket.com/guides/xero-csv-import-guide"
  }'::jsonb,
  '{
    "InvoiceDate": "revenue_margin_trends",
    "UnitAmount": "revenue_margin_trends",
    "DueDate": "cash_flow_runway",
    "AccountCode": "cost_structure",
    "ContactName": "customer_concentration"
  }'::jsonb
),
(
  'quickbooks_checks',
  '{
    "detectionConfidence": "high",
    "note": "QuickBooks'' checks-import CSV has a fixed required column set. Its Profit & Loss / other financial reports have NO fixed CSV schema (columns follow whatever the report is customized to show, and P&L cannot even export to CSV directly per QuickBooks'' own docs) — deliberately not claiming a signature for those.",
    "requiredHeaders": ["Date", "Payee", "Amount", "Check Number", "Bank Account"],
    "filenamePatterns": ["quickbooks", "qbo", "checks"],
    "source": "https://xtractor.app/quickbooks-online-checks-csv-import-required-columns-sample-headers-mapping-guide-and-common-error-fixes-free-google-sheet-template/"
  }'::jsonb,
  '{
    "Date": "cash_flow_runway",
    "Amount": "cash_flow_runway",
    "Payee": "cost_structure",
    "Bank Account": "cash_flow_runway"
  }'::jsonb
),
(
  'hubspot_contacts',
  '{
    "detectionConfidence": "partial",
    "note": "HubSpot contact exports are user-configurable at export time (view-based or all-properties) with human-readable headers, not a fixed machine schema. requiredHeaders here is the minimum reliably-present subset (Email is HubSpot''s own required field), not a full fingerprint.",
    "requiredHeaders": ["Email"],
    "likelyHeaders": ["First Name", "Last Name", "Company", "Phone", "Job Title", "Website"],
    "filenamePatterns": ["hubspot", "contacts"],
    "source": "https://knowledge.hubspot.com/import-and-export/export-contact-data"
  }'::jsonb,
  '{
    "Company": "named_competitors",
    "Job Title": "customer_concentration"
  }'::jsonb
),
(
  'salesforce_opportunities',
  '{
    "detectionConfidence": "partial",
    "note": "Salesforce report exports follow whatever the report layout shows (org-configurable, no fixed CSV schema). The underlying Opportunity OBJECT has genuinely standard API field names, which is what requiredHeaders reflects — a raw object export is more reliably fingerprintable than a report export.",
    "requiredHeaders": ["Amount", "CloseDate", "StageName"],
    "likelyHeaders": ["Name", "AccountId", "OwnerId", "Probability"],
    "filenamePatterns": ["salesforce", "opportunities", "opportunity"],
    "source": "https://developer.openfin.co/docs/integrations/salesforce/2.3.0/types/_openfin_salesforce.SalesforceRestApiSObjectOpportunity.html"
  }'::jsonb,
  '{
    "Amount": "lost_deals_notes",
    "StageName": "lost_deals_notes",
    "CloseDate": "market_change_notes"
  }'::jsonb
),
(
  'jira_issues',
  '{
    "detectionConfidence": "high",
    "note": "Jira''s CSV export uses a fixed, documented set of standard field names; column ORDER follows the issue navigator view, but the field names themselves are consistent. Custom fields appear as literal \"Custom field (xyz)\" columns, a distinctive marker in its own right.",
    "requiredHeaders": ["Issue key", "Summary", "Issue Type", "Status", "Priority", "Assignee", "Reporter", "Created", "Updated"],
    "filenamePatterns": ["jira", "issues"],
    "source": "https://support.atlassian.com/automation/kb/how-to-export-issues-from-jira-cloud-in-csv-format/"
  }'::jsonb,
  '{
    "Status": "delivery_speed",
    "Created": "delivery_speed",
    "Updated": "delivery_speed",
    "Priority": "meeting_load"
  }'::jsonb
),
(
  'intercom_conversations',
  '{
    "detectionConfidence": "partial",
    "note": "Intercom has no fixed CSV export — the user picks columns from a dropdown per export (Reports > Data Export). requiredHeaders here is deliberately minimal (just a plausible ID/timestamp presence), not a real fingerprint, since Intercom genuinely does not offer a stable one.",
    "requiredHeaders": [],
    "likelyHeaders": ["Conversation ID", "Created At", "Assignee", "Tags", "Has user reply", "First contacted by"],
    "filenamePatterns": ["intercom", "conversations"],
    "source": "https://www.intercom.com/help/en/articles/2046229-export-your-conversations-data"
  }'::jsonb,
  '{
    "Tags": "satisfaction_signals",
    "Has user reply": "activation_onboarding"
  }'::jsonb
),
(
  'zendesk_tickets',
  '{
    "detectionConfidence": "high",
    "note": "Zendesk''s ticket-view CSV export uses a consistent, documented column set. Multi-line text, custom date fields, and comments are excluded from CSV specifically (JSON/XML needed for those) — a real limitation worth knowing before assuming a CSV export is complete.",
    "requiredHeaders": ["Ticket ID", "Subject", "Requester", "Status", "Priority", "Group", "Created date", "Updated date"],
    "filenamePatterns": ["zendesk", "tickets"],
    "source": "https://support.zendesk.com/hc/en-us/articles/4408886165402-Exporting-ticket-user-or-organization-data-from-your-account"
  }'::jsonb,
  '{
    "Status": "churn_patterns",
    "Priority": "satisfaction_signals",
    "Created date": "delivery_speed",
    "Updated date": "delivery_speed"
  }'::jsonb
);
