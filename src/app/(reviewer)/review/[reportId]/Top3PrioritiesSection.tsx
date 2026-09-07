import { Card } from "@/app/_components/ui/Card";
import { ReportSecondOpinionPanel } from "./ReportSecondOpinionPanel";
import { type FindingRow, type ReportSecondOpinionDisplay, displayedContent } from "./types";

export function Top3PrioritiesSection({
  top3FindingIds,
  findingById,
  pending,
  onMoveTop3,
  reportId,
  initialReportSecondOpinion,
}: {
  top3FindingIds: string[];
  findingById: Map<string, FindingRow>;
  pending: boolean;
  onMoveTop3: (index: number, direction: -1 | 1) => void;
  reportId: string;
  initialReportSecondOpinion: ReportSecondOpinionDisplay | null;
}) {
  if (top3FindingIds.length === 0) return null;
  return (
    <Card title="Top 3 priorities" className="mb-8">
      <ol className="space-y-2">
        {top3FindingIds.map((id, i) => {
          const f = findingById.get(id);
          return (
            <li key={id} className="flex items-center justify-between text-sm text-neutral-800 dark:text-neutral-200">
              <span>
                {i + 1}. {f ? displayedContent(f).title : id}
              </span>
              <span className="flex gap-1">
                <button
                  disabled={pending || i === 0}
                  onClick={() => onMoveTop3(i, -1)}
                  className="rounded-md border border-neutral-300 px-2 py-0.5 hover:bg-neutral-50 disabled:opacity-30 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  ↑
                </button>
                <button
                  disabled={pending || i === top3FindingIds.length - 1}
                  onClick={() => onMoveTop3(i, 1)}
                  className="rounded-md border border-neutral-300 px-2 py-0.5 hover:bg-neutral-50 disabled:opacity-30 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  ↓
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <ReportSecondOpinionPanel reportId={reportId} findingById={findingById} initialOpinion={initialReportSecondOpinion} />
    </Card>
  );
}
