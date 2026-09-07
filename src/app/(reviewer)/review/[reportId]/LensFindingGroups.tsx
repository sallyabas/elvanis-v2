import { Card } from "@/app/_components/ui/Card";
import { Button } from "@/app/_components/ui/Button";
import { FindingCard } from "./FindingCard";
import { ConciergeNoteEditor } from "./ConciergeNoteEditor";
import { EditForm } from "./EditForm";
import { SecondOpinionPanel } from "./SecondOpinionPanel";
import type { RecommendationLibraryEntry } from "@/lib/recommendations/recommendation-library";
import { type ConciergeNote, type EditFormValues, type FindingRow, type SecondOpinionDisplay, displayedContent, LENS_LABELS, LENS_ORDER } from "./types";

/**
 * ReviewWorkspaceClient.tsx decomposition (confirmed 2026-09-07) — the
 * core review list, the largest single piece of the original workspace.
 * One Card per lens (only lenses with undisputed findings render), each
 * finding gets FindingCard + ConciergeNoteEditor + its own Accept/Edit/
 * Reject controls.
 *
 * Second-opinion comparison view (confirmed 2026-09-05, direct founder
 * request) — reviewer second opinion v1 scope is Financial lens only, so
 * this is the only lens getting the real side-by-side layout; every other
 * lens keeps the original stacked treatment. The reviewer's own decision
 * (accept/edit/reject) and Claude's second-opinion result sit in two
 * columns on the same screen, using the exact same decisionControls/
 * SecondOpinionPanel already built — no new data, purely a layout change.
 */
export function LensFindingGroups({
  undisputedFindings,
  editingId,
  onStartEditing,
  onCancelEditing,
  onSaveEdit,
  onAccept,
  onReject,
  recommendationLibrary,
  reportId,
  conciergeNotesByFindingId,
  currentReviewerName,
  secondOpinionsByFindingId,
  pending,
}: {
  undisputedFindings: FindingRow[];
  editingId: string | null;
  onStartEditing: (findingId: string) => void;
  onCancelEditing: () => void;
  onSaveEdit: (f: FindingRow, changes: EditFormValues, notes: string) => void;
  onAccept: (findingId: string) => void;
  onReject: (findingId: string) => void;
  recommendationLibrary: RecommendationLibraryEntry[];
  reportId: string;
  conciergeNotesByFindingId: Record<string, ConciergeNote>;
  currentReviewerName: string;
  secondOpinionsByFindingId: Record<string, SecondOpinionDisplay>;
  pending: boolean;
}) {
  return (
    <>
      {LENS_ORDER.filter((lens) => undisputedFindings.some((f) => f.lens === lens)).map((lens) => (
        <Card key={lens} title={LENS_LABELS[lens]} className="mb-8">
          <ul className="space-y-4">
            {undisputedFindings
              .filter((f) => f.lens === lens)
              .map((f) => {
                const decisionControls =
                  editingId === f.id ? (
                    <EditForm
                      lens={f.lens}
                      initial={displayedContent(f)}
                      recommendationLibrary={recommendationLibrary}
                      onCancel={onCancelEditing}
                      onSave={(changes, notes) => onSaveEdit(f, changes, notes)}
                    />
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" disabled={pending} onClick={() => onAccept(f.id)} className="px-2 py-1 text-xs">
                        Accept
                      </Button>
                      <Button variant="secondary" disabled={pending} onClick={() => onStartEditing(f.id)} className="px-2 py-1 text-xs">
                        Edit
                      </Button>
                      <Button variant="secondary" disabled={pending} onClick={() => onReject(f.id)} className="px-2 py-1 text-xs">
                        Reject
                      </Button>
                    </div>
                  );

                return (
                  <li key={f.id}>
                    <FindingCard f={f} />
                    <ConciergeNoteEditor
                      reportId={reportId}
                      findingId={f.id}
                      existingNote={conciergeNotesByFindingId[f.id]}
                      defaultAuthorName={currentReviewerName}
                    />
                    {f.lens === "financial" ? (
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Your decision</p>
                          {decisionControls}
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Second opinion (Claude)</p>
                          <SecondOpinionPanel reportId={reportId} findingId={f.id} existingOpinion={secondOpinionsByFindingId[f.id]} />
                        </div>
                      </div>
                    ) : (
                      decisionControls
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>
      ))}
    </>
  );
}
