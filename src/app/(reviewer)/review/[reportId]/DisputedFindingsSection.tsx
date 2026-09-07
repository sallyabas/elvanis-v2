import { Button } from "@/app/_components/ui/Button";
import { FindingCard } from "./FindingCard";
import { ConciergeNoteEditor } from "./ConciergeNoteEditor";
import { DisputeResolutionForm } from "./DisputeResolutionForm";
import type { DisputeResolution } from "@/lib/reviewer/workspace";
import { type ConciergeNote, type EditFormValues, type FindingRow, displayedContent } from "./types";

export function DisputedFindingsSection({
  disputedFindings,
  reportId,
  conciergeNotesByFindingId,
  currentReviewerName,
  disputingId,
  onStartDisputing,
  onCancelDisputing,
  onResolveDispute,
}: {
  disputedFindings: FindingRow[];
  reportId: string;
  conciergeNotesByFindingId: Record<string, ConciergeNote>;
  currentReviewerName: string;
  disputingId: string | null;
  onStartDisputing: (findingId: string) => void;
  onCancelDisputing: () => void;
  onResolveDispute: (f: FindingRow, resolution: DisputeResolution, notes: string, changes?: EditFormValues) => void;
}) {
  if (disputedFindings.length === 0) return null;
  return (
    <section className="mb-8 rounded-lg bg-neutral-100 p-5 shadow-card-1 dark:bg-neutral-800">
      <h2 className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">Disputed findings (client marked not confident)</h2>
      <ul className="space-y-4">
        {disputedFindings.map((f) => (
          <li key={f.id}>
            <FindingCard f={f} />
            <ConciergeNoteEditor
              reportId={reportId}
              findingId={f.id}
              existingNote={conciergeNotesByFindingId[f.id]}
              defaultAuthorName={currentReviewerName}
            />
            {f.dispute_resolution_notes ? (
              <p className="mt-2 text-xs text-green-700 dark:text-green-400">Resolved: {f.dispute_resolution_notes}</p>
            ) : disputingId === f.id ? (
              <DisputeResolutionForm
                initial={displayedContent(f)}
                onCancel={onCancelDisputing}
                onSave={(resolution, notes, changes) => onResolveDispute(f, resolution, notes, changes)}
              />
            ) : (
              <Button variant="secondary" onClick={() => onStartDisputing(f.id)} className="mt-2 px-2 py-1 text-xs">
                Resolve Dispute
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
