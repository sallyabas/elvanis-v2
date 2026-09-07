"use client";

import { useState, useRef } from "react";
import { Alert } from "@/app/_components/ui/Alert";
import { requestSecondOpinionAction } from "./actions";
import { type SecondOpinionDisplay, SECOND_OPINION_CATEGORY_LABELS } from "./types";

/**
 * Reviewer "second opinion" (confirmed 2026-09-04) — reviewer-triggered on
 * demand, from a genuinely different model (Claude) than whatever drafted
 * the finding. Purely advisory display: a concern flag with a category and
 * reasoning, or an honest clean-pass confirmation — never a gate, never an
 * action this component can take on the finding itself. v1 scope
 * (Financial lens only) is enforced server-side in
 * requestFinancialLensSecondOpinion(), not here — this component would
 * simply surface whatever error that throws for any other lens.
 *
 * Until a real ANTHROPIC_API_KEY is configured, clicking this button
 * surfaces a clear "Something went wrong reaching the server" error (the
 * same honest failure path this codebase already uses everywhere else for
 * an uncaught RPC/provider failure) — expected and correct, not a bug,
 * same as GroqProvider's own "GROQ_API_KEY is not set" pattern.
 */
export function SecondOpinionPanel({
  reportId,
  findingId,
  existingOpinion,
}: {
  reportId: string;
  findingId: string;
  existingOpinion: SecondOpinionDisplay | undefined;
}) {
  const [opinion, setOpinion] = useState(existingOpinion);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Real reentrancy guard, confirmed 2026-09-04 (full-platform E2E
  // re-test — first attempted with `if (status === "loading") return;`,
  // caught by this exact test as insufficient: two click EVENTS
  // dispatched synchronously in the same JS tick both invoke the SAME
  // handler closure from the SAME render, so both read the identical,
  // still-"idle" `status` value — `setStatus("loading")` from the first
  // invocation hasn't been committed to a new render yet, so the second
  // invocation's closure never sees it. A ref mutates in place,
  // synchronously, shared across both invocations regardless of React's
  // render/commit timing — the actual fix, not the state check.
  const isRequestingRef = useRef(false);

  async function handleRequest() {
    if (isRequestingRef.current) return;
    isRequestingRef.current = true;
    setStatus("loading");
    setError(null);
    try {
      const result = await requestSecondOpinionAction(reportId, findingId);
      setOpinion(result);
      setStatus("idle");
    } catch {
      setStatus("error");
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      isRequestingRef.current = false;
    }
  }

  return (
    <div className="mt-2">
      {opinion ? (
        <div
          className={`rounded-md border p-2 text-xs ${
            opinion.concern
              ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
              : "border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800"
          }`}
        >
          <p className="font-medium text-neutral-800 dark:text-neutral-200">
            {opinion.concern ? `⚠ Second opinion: ${SECOND_OPINION_CATEGORY_LABELS[opinion.category!]}` : "✓ Second opinion: no concerns"}
            <span className="ml-2 font-normal text-neutral-400 dark:text-neutral-500">({opinion.model})</span>
          </p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">{opinion.reasoning}</p>
          <button
            type="button"
            onClick={handleRequest}
            disabled={status === "loading"}
            className="mt-1 text-neutral-400 hover:text-neutral-600 hover:underline dark:text-neutral-500 dark:hover:text-neutral-300"
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
          {status === "loading" ? "Getting a second opinion…" : "Get a second opinion"}
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
