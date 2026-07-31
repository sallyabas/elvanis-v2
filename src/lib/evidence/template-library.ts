// Known-source template library — recognized export signatures (column
// headers, file-naming patterns) for common tools, matched against
// export_source_signatures. A recognized file auto-selects its field-mapping
// template; unrecognized files fall back to generic parsing. See spec §2.1,
// §2.3 step 2. Signature set (Xero, QuickBooks, HubSpot, Salesforce, Jira,
// Intercom, Zendesk) is Phase 2 work — not yet populated.

export async function matchExportSignature(_fileHeaders: string[]): Promise<string | null> {
  throw new Error("matchExportSignature: not yet implemented (Phase 2)");
}
