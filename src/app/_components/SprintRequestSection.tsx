"use client";

import { useState } from "react";
import { requestSprintChooseOwnFindingAction, requestSprintLetElvanisChooseAction } from "@/lib/execution-sprint/request-actions";
import { Button } from "@/app/_components/ui/Button";
import { Select } from "@/app/_components/ui/Select";
import { Alert } from "@/app/_components/ui/Alert";

export interface SprintEligibleFinding {
  id: string;
  title: string;
}

/**
 * The real, genuinely new client-facing Execution Sprint entry point
 * (confirmed 2026-09-07, unified flow spec) — a report-level choice, not
 * scattered per-finding buttons like SprintInterestButton (kept
 * unchanged, a different mechanism: signaling interest, not requesting a
 * sprint outright). Two real, distinct paths:
 *
 * (a) "I'll choose the finding myself" — shown plainly as the client's
 *     own judgment/responsibility, not an Elvanis recommendation.
 * (b) "Let Elvanis decide" — a reviewer picks which finding is actually
 *     worth scoping.
 *
 * Either way, no real Groq work happens until a reviewer marks the
 * resulting request paid (see execution-sprint/payment-gate.ts) — this
 * component only creates the request and shows a real confirmation.
 */
export function SprintRequestSection({
  companyId,
  reportId,
  eligibleFindings,
}: {
  companyId: string;
  reportId: string;
  eligibleFindings: SprintEligibleFinding[];
}) {
  const [mode, setMode] = useState<"idle" | "choosing_own" | "sending" | "sent" | "error">("idle");
  const [selectedFindingId, setSelectedFindingId] = useState(eligibleFindings[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleChooseOwn() {
    if (!selectedFindingId) return;
    setMode("sending");
    setError(null);
    try {
      const result = await requestSprintChooseOwnFindingAction(companyId, reportId, selectedFindingId);
      if (result.success) {
        setMode("sent");
      } else {
        setMode("error");
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setMode("error");
      setError("Something went wrong reaching the server — please try again.");
    }
  }

  async function handleLetElvanisChoose() {
    setMode("sending");
    setError(null);
    try {
      const result = await requestSprintLetElvanisChooseAction(companyId, reportId);
      if (result.success) {
        setMode("sent");
      } else {
        setMode("error");
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setMode("error");
      setError("Something went wrong reaching the server — please try again.");
    }
  }

  if (eligibleFindings.length === 0) return null;

  if (mode === "sent") {
    return (
      <Alert variant="success" className="mt-4">
        Request sent — your reviewer will confirm which finding this covers (if not already chosen) and follow up on
        payment. No work starts until that&apos;s confirmed.
      </Alert>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-card-1 dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-1 font-medium text-neutral-900 dark:text-neutral-50">Want help implementing one of these?</h3>
      <p className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
        An Execution Sprint is a bounded, paid engagement to actually fix one finding. Pick which one, or let us pick
        for you.
      </p>

      {mode === "choosing_own" ? (
        <div className="space-y-2">
          <Select value={selectedFindingId} onChange={(e) => setSelectedFindingId(e.target.value)}>
            {eligibleFindings.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </Select>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            This is your own call — we&apos;re not recommending this specific finding, just letting you request help
            on the one you pick.
          </p>
          <div className="flex gap-2">
            <Button type="button" disabled={mode !== "choosing_own"} onClick={handleChooseOwn}>
              Request this finding
            </Button>
            <Button type="button" variant="secondary" onClick={() => setMode("idle")}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={mode === "sending"} onClick={() => setMode("choosing_own")}>
            I&apos;ll choose the finding myself
          </Button>
          <Button type="button" variant="secondary" disabled={mode === "sending"} onClick={handleLetElvanisChoose}>
            Let Elvanis decide
          </Button>
        </div>
      )}

      {mode === "error" && error && (
        <Alert variant="error" className="mt-2">
          {error}
        </Alert>
      )}
    </div>
  );
}
