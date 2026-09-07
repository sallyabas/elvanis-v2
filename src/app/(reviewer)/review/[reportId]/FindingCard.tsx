import { SEVERITY_STYLES } from "@/lib/severity-badge";
import { type FindingRow, displayedContent, STATUS_BADGE } from "./types";

export function FindingCard({ f }: { f: FindingRow }) {
  const content = displayedContent(f);
  const isDraft = f.reviewer_status === "draft";
  return (
    <div
      className={`rounded-md border bg-white p-3 shadow-card-1 dark:bg-neutral-900 ${isDraft ? "border-amber-300 dark:border-amber-800" : "border-neutral-200 dark:border-neutral-700"}`}
    >
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <span className={`rounded-full px-2 py-0.5 ${SEVERITY_STYLES[content.severity]}`}>{content.severity}</span>
        {f.origin && <span>· {f.origin}</span>}
        <span>· confidence: {content.confidenceLevel}</span>
        <span className={`rounded-full px-2 py-0.5 ${STATUS_BADGE[f.reviewer_status]}`}>{isDraft ? "needs decision" : f.reviewer_status}</span>
      </div>
      <div className="font-medium text-neutral-900 dark:text-neutral-50">{content.title}</div>
      <dl className="mt-2 space-y-1 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-neutral-400 dark:text-neutral-500">Diagnosis</dt>
          <dd className="text-neutral-600 dark:text-neutral-400">{content.diagnosis}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-neutral-400 dark:text-neutral-500">Root cause</dt>
          <dd className="text-neutral-600 dark:text-neutral-400">{content.rootCause}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-neutral-400 dark:text-neutral-500">Recommended action</dt>
          <dd className="text-neutral-600 dark:text-neutral-400">{content.recommendedAction}</dd>
        </div>
      </dl>
    </div>
  );
}
