import { Card } from "@/app/_components/ui/Card";
import { type Props, formatOverlapTag } from "./types";

/** Dormant similar-patterns infrastructure, surfaced 2026-08-06 — genuinely empty until real case volume exists (see case-library.ts). Reviewer-only, never client-facing. */
export function SimilarPatternsSection({ similarPatterns }: { similarPatterns: Props["similarPatterns"] }) {
  return (
    <Card title="Similar patterns across other companies" className="mt-6">
      {similarPatterns.length === 0 ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Not enough real case volume yet — this only surfaces once at least 3 genuinely distinct other companies
          show real overlap, so it doesn&apos;t show a coincidental one-off match as if it were a pattern.
        </p>
      ) : (
        <ul className="space-y-2">
          {similarPatterns.map((p) => (
            <li key={p.reportId} className="text-sm text-neutral-800 dark:text-neutral-200">
              <span className="font-medium">{p.companyName}</span>{" "}
              <span className="text-neutral-500 dark:text-neutral-400">
                · {(p.similarityScore * 100).toFixed(0)}% overlap · {p.overlappingTags.map(formatOverlapTag).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
