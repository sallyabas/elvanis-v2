"use client";

import { useState, useRef } from "react";
import { Alert } from "@/app/_components/ui/Alert";
import { requestReportSecondOpinionAction } from "./actions";
import { type FindingRow, type ReportSecondOpinionDisplay, REPORT_SECOND_OPINION_CATEGORY_LABELS, displayedContent } from "./types";

/**
 * Reviewer report-level second opinion (confirmed 2026-09-04) — a real,
 * separate feature from SecondOpinionPanel: checks the report's ACTUAL
 * Top 3 selection against the client's stated goal, using the Goal
 * Relevance Ranking Rubric, rather than one finding's own internal
 * quality. Same self-contained-component/try-catch-finally pattern. The
 * response is a real array of concerns (a multi-finding selection can
 * have more than one thing wrong with it at once) plus a required overall
 * assessment — richer than the per-finding version's single concern/
 * category/reasoning triple, reflecting what's actually being checked.
 */
export function ReportSecondOpinionPanel({
  reportId,
  findingById,
  initialOpinion,
}: {
  reportId: string;
  findingById: Map<string, FindingRow>;
  initialOpinion: ReportSecondOpinionDisplay | null;
}) {
  const [opinion, setOpinion] = useState(initialOpinion);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Real reentrancy guard (confirmed 2026-09-04) — see SecondOpinionPanel's
  // own equivalent guard for why a plain `status` state check isn't
  // sufficient (a stale-closure gap under two synchronous click events),
  // and why a ref is the actual fix.
  const isRequestingRef = useRef(false);

  async function handleRequest() {
    if (isRequestingRef.current) return;
    isRequestingRef.current = true;
    setStatus("loading");
    setError(null);
    try {
      const result = await requestReportSecondOpinionAction(reportId);
      setOpinion(result);
      setStatus("idle");
    } catch {
      setStatus("error");
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      isRequestingRef.current = false;
    }
  }

  function findingTitle(id: string): string {
    const f = findingById.get(id);
    return f ? displayedContent(f).title : id;
  }

  return (
    <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
      {opinion ? (
        <div className="space-y-2">
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {opinion.overallAssessment} <span className="text-neutral-400 dark:text-neutral-500">({opinion.model})</span>
          </p>
          {opinion.concerns.length > 0 && (
            <ul className="space-y-2">
              {opinion.concerns.map((c, i) => (
                <li
                  key={i}
                  className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs dark:border-amber-800 dark:bg-amber-950"
                >
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">
                    ⚠ {REPORT_SECOND_OPINION_CATEGORY_LABELS[c.category]}
                    {c.findingIds.length > 0 && (
                      <span className="ml-1 font-normal text-neutral-500 dark:text-neutral-400">
                        — {c.findingIds.map(findingTitle).join(", ")}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-neutral-600 dark:text-neutral-400">{c.reasoning}</p>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={handleRequest}
            disabled={status === "loading"}
            className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline dark:text-neutral-500 dark:hover:text-neutral-300"
          >
            {status === "loading" ? "Asking again…" : "Ask again"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleRequest}
          disabled={status === "loading"}
          className="text-xs text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400"
        >
          {status === "loading" ? "Getting a second opinion…" : "Get a second opinion on Top 3"}
        </button>
      )}
      {status === "error" && error && (
        <Alert variant="error" className="mt-1 py-1 text-xs">
          {error}
        </Alert>
      )}
    </div>
  );
}
