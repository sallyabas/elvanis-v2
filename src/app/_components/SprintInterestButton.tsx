"use client";

import { useState } from "react";
import { requestSprintInterest, type SprintInterestResponse } from "@/lib/execution-sprint/interest-requests";
import { Alert } from "@/app/_components/ui/Alert";
import { Button } from "@/app/_components/ui/Button";

/**
 * Client-facing Execution Sprint interest button (confirmed 2026-08-06,
 * honest UX review pass; given real explicit choices 2026-08-12, direct
 * founder request). Doesn't create the sprint (still reviewer-triggered,
 * no in-app checkout exists), only signals a real response and routes to
 * the reviewer, same "request + human follow-up" pattern as
 * SessionRequestButton — but now genuinely a choice, not a single
 * ambiguous action that always meant "yes."
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
  const [status, setStatus] = useState<"idle" | "choosing_other" | "sending" | "sent" | "error">(
    alreadyRequested ? "sent" : "idle",
  );
  const [sentResponse, setSentResponse] = useState<SprintInterestResponse | null>(null);
  const [otherNote, setOtherNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleRespond(response: SprintInterestResponse, note: string | null) {
    setStatus("sending");
    setError(null);
    // Real gap found live (confirmed 2026-09-05, combinatorial E2E pass):
    // no try/catch existed here at all — a genuine RPC-level rejection
    // (not a resolved {success:false}, which the branch below already
    // handles) left `status` stuck on "sending" forever, with every
    // button permanently disabled and no way to retry. The exact same
    // uncaught-RPC-failure class already found and fixed repeatedly
    // elsewhere in this codebase (module intake forms, reviewer workspace
    // action buttons, DocumentUploadField, FindingNotApplicableButton —
    // which already had this guard) — simply never swept to this
    // component. Fixed the same way: a real try/catch, matching the
    // shared "Something went wrong reaching the server" copy this
    // codebase already uses for this exact failure mode everywhere else.
    try {
      const result = await requestSprintInterest(companyId, reportId, findingId, response, note);
      if (result.success) {
        setSentResponse(response);
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
    const message =
      sentResponse === "not_now"
        ? "Noted — no follow-up needed."
        : "Sent — your reviewer will follow up.";
    return (
      <Alert variant="success" className="mt-2 py-2 text-xs">
        {message}
      </Alert>
    );
  }

  if (status === "choosing_other") {
    return (
      <div className="mt-2 space-y-2">
        <textarea
          value={otherNote}
          onChange={(e) => setOtherNote(e.target.value)}
          rows={2}
          placeholder="What would help — e.g. a question first, a different priority…"
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <div className="flex gap-2">
          {/* "Send" now uses the shared Button component (confirmed
              2026-09-05, code-quality audit) — an exact visual match to
              Button's own primary variant, no design change. "Cancel"
              below stays raw markup, deliberately — see this file's own
              docblock note near the "Not now"/"Something else" buttons:
              its neutral/muted outline style has no equivalent Button
              variant, and inventing one for this one file's three buttons
              would either be low-value scope creep or a silent color
              change from muted-gray to accent-outline. */}
          <Button type="button" size="sm" onClick={() => handleRespond("other", otherNote.trim() || null)} disabled={status !== "choosing_other" || otherNote.trim().length === 0}>
            Send
          </Button>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
        </div>
        {error && (
          <Alert variant="error" className="py-2 text-xs">
            {error}
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <p className="mb-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300">Interested in help implementing this?</p>
      <div className="flex flex-wrap gap-2">
        {/* "Yes" now uses the shared Button component (confirmed
            2026-09-05, code-quality audit) — an exact visual match to
            Button's own primary variant. "Not now"/"Something else"
            below stay raw markup, deliberately — see this file's own
            "Send"/"Cancel" note above for the full reasoning. */}
        <Button type="button" size="sm" onClick={() => handleRespond("interested", null)} disabled={status === "sending"}>
          Yes
        </Button>
        <button
          type="button"
          onClick={() => handleRespond("not_now", null)}
          disabled={status === "sending"}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={() => setStatus("choosing_other")}
          disabled={status === "sending"}
          className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Something else
        </button>
      </div>
      {status === "error" && error && (
        <Alert variant="error" className="mt-2 py-2 text-xs">
          {error}
        </Alert>
      )}
    </div>
  );
}
