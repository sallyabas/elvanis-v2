/** ReviewWorkspaceClient.tsx decomposition (confirmed 2026-09-07) — the smallest section, genuinely self-contained. */
export function MandatoryDecisionBanner({ draftFindingsCount, unresolvedConflictsCount }: { draftFindingsCount: number; unresolvedConflictsCount: number }) {
  if (draftFindingsCount === 0 && unresolvedConflictsCount === 0) return null;
  return (
    <section className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-card-1 dark:bg-red-950 dark:text-red-300">
      <p className="font-medium">Mandatory before this report can be approved:</p>
      <ul className="mt-1 list-inside list-disc">
        {draftFindingsCount > 0 && <li>{draftFindingsCount} finding(s) still need a decision — Accept, Edit, or Reject each one below.</li>}
        {unresolvedConflictsCount > 0 && <li>{unresolvedConflictsCount} flagged conflict(s) still unresolved.</li>}
      </ul>
    </section>
  );
}
