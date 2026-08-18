"use client";

import { useState } from "react";
import { confirmSprintFindingAction } from "./actions";
import { Card } from "@/app/_components/ui/Card";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

export interface AlternativeFinding {
  id: string;
  title: string;
}

/**
 * Real client confirm-or-reselect step (confirmed 2026-08-18, direct
 * founder question — "does the client see any confirmation before a
 * Sprint formally begins?" confirmed no, this closes that gap). The
 * reviewer's own pick is pre-selected and clearly labeled "suggested by
 * your reviewer" — this is a real choice, not a rubber stamp, but it's
 * also deliberately not opened up to a free choice from scratch: the
 * only alternatives offered are findings the client themselves already
 * marked "interested in help" on for this same report.
 */
export function ProposedSprintConfirm({
  sprintId,
  companyName,
  proposedFinding,
  alternatives,
}: {
  sprintId: string;
  companyName: string;
  proposedFinding: { id: string; title: string; diagnosis: string };
  alternatives: AlternativeFinding[];
}) {
  const [selectedId, setSelectedId] = useState(proposedFinding.id);
  const [status, setStatus] = useState<"idle" | "sending" | "confirmed" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setStatus("sending");
    setError(null);
    try {
      const result = await confirmSprintFindingAction(sprintId, selectedId);
      if (result.success) {
        setStatus("confirmed");
      } else {
        setStatus("error");
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setError("Something went wrong reaching the server — please try again.");
    }
  }

  if (status === "confirmed") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="mb-2 text-xl font-semibold text-neutral-900 dark:text-neutral-50">{companyName}</h1>
        <Alert variant="success">Confirmed — thanks. Your reviewer is now finalizing the task plan; we&apos;ll let you know once it&apos;s ready.</Alert>
      </div>
    );
  }

  const options: (AlternativeFinding & { isProposed: boolean })[] = [
    { id: proposedFinding.id, title: proposedFinding.title, isProposed: true },
    ...alternatives.map((a) => ({ ...a, isProposed: false })),
  ];

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-xl font-semibold text-neutral-900 dark:text-neutral-50">{companyName}</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Your reviewer suggests starting your Execution Sprint here. Confirm it, or choose a different finding below —
        your reviewer will still do the real task-scoping work once you&apos;ve decided.
      </p>

      <Card title="Suggested by your reviewer" className="mb-4">
        <p className="font-medium text-neutral-900 dark:text-neutral-50">{proposedFinding.title}</p>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{proposedFinding.diagnosis}</p>
      </Card>

      {alternatives.length > 0 && (
        <Card title="Choose which finding to address" className="mb-4">
          <ul className="space-y-2">
            {options.map((opt) => (
              <li key={opt.id}>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-800 dark:text-neutral-200">
                  <input
                    type="radio"
                    name="selectedFinding"
                    checked={selectedId === opt.id}
                    onChange={() => setSelectedId(opt.id)}
                    className="mt-0.5 accent-accent"
                  />
                  <span>
                    {opt.title}
                    {opt.isProposed && (
                      <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-400">(reviewer&apos;s suggestion)</span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            Only findings you previously marked &quot;interested in help&quot; on can be chosen here — not a free
            choice from every finding on your report.
          </p>
        </Card>
      )}

      {status === "error" && error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <Button disabled={status === "sending"} onClick={handleConfirm}>
        {status === "sending" ? "Confirming…" : selectedId === proposedFinding.id ? "Confirm this" : "Confirm my choice"}
      </Button>
    </div>
  );
}
