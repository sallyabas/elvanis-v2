/**
 * Export instructions for the 7 known tools (confirmed 2026-08-06) —
 * short, specific "where to click" steps shown directly in the Evidence
 * Intake flow, guiding a client straight into the already-built fill-in
 * template with the right figures in hand. This delivers most of the
 * ease-of-use benefit of native parsing without needing real sample
 * files to build against; full auto-parsing (reading and mapping a
 * client's actual export columns automatically) stays a separate, later
 * piece, per the Evidence Intake scope decision in CLAUDE.md.
 *
 * Curated, not AI-generated — same treatment as self-test-prompts.ts,
 * procurement-categories.ts, and recommendation-library.ts. Navigation
 * paths were researched fresh against each tool's own current help docs
 * (not recalled from training data) — menu paths go stale the same way
 * export column formats do, which is the exact reasoning already applied
 * to export_source_signatures (see its migration docblock). Re-verify
 * before relying on these long-term, same caveat as that table.
 */

export interface ToolExportInstruction {
  tool: string;
  steps: string;
  note?: string;
  source: string;
}

export type EvidenceLensKey = "financial" | "commercial" | "execution" | "product";

export const EXPORT_INSTRUCTIONS_BY_LENS: Record<EvidenceLensKey, ToolExportInstruction[]> = {
  financial: [
    {
      tool: "Xero",
      steps:
        "Accounting → Reports → Profit and Loss (or Cash Summary for runway) → set your date range → Update → Export → Create CSV file.",
      source: "https://central.xero.com/0/article/Export-data-out-of-Xero",
    },
    {
      tool: "QuickBooks Online",
      // Real UX gap found and fixed 2026-08-06 (honest UX review pass):
      // this used to end on "Export to Excel" — a step that reads as
      // complete on its own — with the actual CSV requirement tucked into
      // a separate `note` rendered in the faintest gray text on the page.
      // A real first-time user following the steps literally would stop
      // at Excel and never see it. Folded the full required path into one
      // continuous sentence instead, so there's no natural stopping point
      // before the file the client actually needs to attach.
      steps:
        'Reports → Standard reports → search "Profit and Loss" → Export/Print dropdown → Export to Excel (QuickBooks Online can\'t export this report directly to CSV) → open the file and Save As → CSV.',
      source:
        "https://quickbooks.intuit.com/learn-support/en-us/help-article/report-management/export-reports-excel-quickbooks-online/L7iAoP97n_US_en_US",
    },
  ],
  commercial: [
    {
      tool: "HubSpot",
      steps: "CRM → Contacts (or Sales → Deals for pipeline/lost deals) → apply the view/filter you want → Export (above the table) → choose CSV.",
      note: "HubSpot emails you a download link rather than downloading instantly — check the inbox tied to your HubSpot account.",
      source: "https://knowledge.hubspot.com/import-and-export/export-contact-data",
    },
    {
      tool: "Salesforce",
      steps: "Reports tab → open (or build) your Opportunities report → Export button above the results → choose CSV.",
      source: "https://help.salesforce.com/s/articleView?language=en_US&id=reports_export.htm&type=0",
    },
  ],
  execution: [
    {
      tool: "Jira",
      steps: "Issues → filter to your project/board and date range → Export (top right of the issue navigator) → Export CSV (all fields).",
      note: "Jira caps a single export at 1,000 issues — narrow the date range first if your project is larger.",
      source: "https://support.atlassian.com/automation/kb/how-to-export-issues-from-jira-cloud-in-csv-format/",
    },
  ],
  product: [
    {
      tool: "Intercom",
      steps: "Reports → Data export → Conversations tab → set your date range and fields → Export CSV.",
      note: "Intercom emails the CSV to your workspace's registered address rather than downloading it directly.",
      source: "https://www.intercom.com/help/en/articles/2046229-export-your-conversations-data",
    },
    {
      tool: "Zendesk",
      steps: 'Views (left sidebar) → open the ticket view you want (e.g. "Recently updated tickets") → Actions (top right) → Export as CSV.',
      note: "Zendesk emails the file and caps a single export at 1,000 tickets per view.",
      source: "https://support.zendesk.com/hc/en-us/articles/5521220496154-Exporting-a-view-of-tickets-to-a-CSV-file",
    },
  ],
};
