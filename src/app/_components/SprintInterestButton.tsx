"use client";

import { useState } from "react";
import { requestSprintInterest } from "@/lib/execution-sprint/interest-requests";

/**
 * Client-facing Execution Sprint interest button (confirmed 2026-08-06,
 * honest UX review pass) — shown inline on high-priority findings. Doesn't
 * create the sprint (still reviewer-triggered, no in-app checkout exists),
 * only signals interest and routes to the reviewer, same "request +
 * human follow-up" pattern as SessionRequestButton.
 */
export function SprintInterestButton({
  companyId,
  reportId,
  findingId,
  alreadyRequested,
}: {
  companyId: string;
  reportId: string;
  findingId: string;
  alreadyRequested: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(alreadyRequested ? "sent" : "idle");
  const [error, setError] = useState<string | null>(null);

  async function handleRequest() {
    setStatus("sending");
    setError(null);
    const result = await requestSprintInterest(companyId, reportId, findingId, null);
    if (result.success) {
      setStatus("sent");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  if (status === "sent") {
    return <p className="mt-2 text-xs text-green-700 dark:text-green-400">Interest sent — your reviewer will follow up.</p>;
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleRequest}
        disabled={status === "sending"}
        className="rounded border border-accent px-2 py-1 text-xs font-medium text-accent hover:bg-accent hover:text-accent-ink disabled:opacity-40"
      >
        {status === "sending" ? "Sending…" : "Interested in help implementing this?"}
      </button>
      {status === "error" && error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
