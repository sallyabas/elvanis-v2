"use client";

import { useState } from "react";
import { submitFindingNotApplicableFeedback, type FindingFeedbackSource } from "@/lib/reports/finding-feedback";
import { Alert } from "@/app/_components/ui/Alert";

/**
 * Real "Does not apply to us" feedback action (confirmed 2026-08-16, final
 * Dashboard redesign pass) — deliberately separate from
 * SprintInterestButton's "Interested in help implementing this?" choices.
 * That one is about ACTING on a finding; this one is a correctness signal
 * — the client flagging the finding is simply wrong for their business.
 * Logged for future prompt refinement (finding_feedback table), same
 * discipline as every other feedback-logging mechanism in this codebase —
 * this button never changes the finding itself or hides it from the
 * report; it only records the signal.
 */
export function FindingNotApplicableButton({
  companyId,
  findingSource,
  findingId,
  findingTitle,
  alreadyFlagged,
}: {
  companyId: string;
  findingSource: FindingFeedbackSource;
  findingId: string;
  findingTitle: string;
  alreadyFlagged: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(alreadyFlagged ? "sent" : "idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setStatus("sending");
    setError(null);
    try {
      const result = await submitFindingNotApplicableFeedback(companyId, findingSource, findingId, findingTitle);
      if (result.success) {
        setStatus("sent");
      } else {
        setStatus("error");
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setError("Something went wrong reaching the server — please try again.");
    }
  }

  if (status === "sent") {
    return <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">Noted as not applicable — thanks for the feedback.</p>;
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "sending"}
        className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline disabled:opacity-40 dark:text-neutral-500 dark:hover:text-neutral-300"
      >
        {status === "sending" ? "Saving…" : "Doesn't apply to us?"}
      </button>
      {status === "error" && error && (
        <Alert variant="error" className="mt-1 py-1.5 text-xs">
          {error}
        </Alert>
      )}
    </div>
  );
}
