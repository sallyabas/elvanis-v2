import { Button } from "@/app/_components/ui/Button";
import { SEVERITY_STYLES } from "@/lib/severity-badge";
import type { CascadeSignal } from "@/lib/recommendations/cascade";
import { type FindingRow, displayedContent } from "./types";

export function FixFirstSuggestionsSection({
  fixFirstCandidates,
  cascadeSignals,
  pending,
  onPromoteToTop3,
}: {
  fixFirstCandidates: FindingRow[];
  cascadeSignals: Map<string, CascadeSignal>;
  pending: boolean;
  onPromoteToTop3: (findingId: string) => void;
}) {
  if (fixFirstCandidates.length === 0) return null;
  return (
    <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5 shadow-card-1 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-50">Suggested fix-first (not yet in top 3)</h2>
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        Deterministically flagged: critical severity, high severity directly tied to the client&apos;s stated goal, or upstream of 2+ other findings
        on this report (see below). A suggestion only — promote manually if it belongs in the top 3.
      </p>
      <ul className="space-y-2">
        {fixFirstCandidates.map((f) => {
          const cascade = cascadeSignals.get(f.id);
          return (
            <li key={f.id} className="flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200">
              <span>
                <span className={`mr-2 rounded-full px-2 py-0.5 text-xs ${SEVERITY_STYLES[displayedContent(f).severity]}`}>
                  {displayedContent(f).severity}
                </span>
                {displayedContent(f).title}
                {cascade && cascade.cascadeCount >= 2 && (
                  <span className="ml-2 text-xs text-accent" title={cascade.cascadesToFindingTitles.join(", ")}>
                    upstream of {cascade.cascadeCount} other finding{cascade.cascadeCount === 1 ? "" : "s"}
                  </span>
                )}
              </span>
              {f.reviewer_status === "draft" ? (
                <span className="text-xs text-neutral-400 dark:text-neutral-500">decide this finding first</span>
              ) : (
                <Button variant="secondary" disabled={pending} onClick={() => onPromoteToTop3(f.id)} className="px-2 py-0.5 text-xs">
                  Add to top 3
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
