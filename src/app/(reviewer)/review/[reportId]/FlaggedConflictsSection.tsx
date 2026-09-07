import { Button } from "@/app/_components/ui/Button";
import { ConflictResolutionForm } from "./ConflictResolutionForm";
import { type ConflictRow, type FindingRow, displayedContent } from "./types";

export function FlaggedConflictsSection({
  conflicts,
  findingById,
  resolvingConflictId,
  onStartResolving,
  onCancelResolving,
  onResolveConflict,
}: {
  conflicts: ConflictRow[];
  findingById: Map<string, FindingRow>;
  resolvingConflictId: string | null;
  onStartResolving: (conflictId: string) => void;
  onCancelResolving: () => void;
  onResolveConflict: (conflictId: string, notes: string) => void;
}) {
  if (conflicts.length === 0) return null;
  return (
    <section className="mb-8 rounded-lg bg-orange-50 p-5 shadow-card-1 dark:bg-orange-950">
      <h2 className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-50">Flagged conflicts</h2>
      <ul className="space-y-4">
        {conflicts.map((c) => {
          const a = findingById.get(c.finding_a_id);
          const b = findingById.get(c.finding_b_id);
          return (
            <li key={c.id} className="text-sm">
              <p className="mb-1 text-neutral-900 dark:text-neutral-50">
                <strong>{a ? displayedContent(a).title : c.finding_a_id}</strong> vs.{" "}
                <strong>{b ? displayedContent(b).title : c.finding_b_id}</strong>
              </p>
              <p className="mb-2 text-neutral-600 dark:text-neutral-400">{c.conflict_description}</p>
              {/*
               * AI-suggested resolution (confirmed 2026-08-12, direct
               * founder request) — shown as its own distinct box, not
               * folded into conflict_description, so it's visually
               * clear this is a suggestion to evaluate, not a
               * statement of fact the way the conflict description
               * itself is. Reviewer still has final say — this only
               * prefills the resolution form below, it doesn't
               * resolve anything by itself.
               */}
              {c.ai_suggested_resolution && c.resolution_status === "unresolved" && (
                <p className="mb-2 rounded-md border-l-2 border-orange-400 bg-white px-2 py-1.5 text-xs text-neutral-700 shadow-card-1 dark:border-orange-700 dark:bg-neutral-900 dark:text-neutral-300">
                  <span className="font-semibold text-orange-700 dark:text-orange-400">Suggested resolution: </span>
                  {c.ai_suggested_resolution}
                </p>
              )}
              {c.resolution_status === "reviewer_resolved" ? (
                <p className="text-xs text-green-700 dark:text-green-400">Resolved: {c.reviewer_notes}</p>
              ) : resolvingConflictId === c.id ? (
                <ConflictResolutionForm
                  initialNotes={c.ai_suggested_resolution ?? ""}
                  onCancel={onCancelResolving}
                  onSave={(notes) => onResolveConflict(c.id, notes)}
                />
              ) : (
                <Button variant="secondary" onClick={() => onStartResolving(c.id)} className="px-2 py-1 text-xs">
                  Resolve Conflict
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
