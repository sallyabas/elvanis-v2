"use client";

import { useState } from "react";
import { updateDesiredFutureState } from "@/lib/goals/desired-future-state";

interface Props {
  goalId: string;
  field: "primary" | "secondary";
  initialValue: string | null;
  label: string;
}

export function DesiredFutureStateField({ goalId, field, initialValue, label }: Props) {
  const [value, setValue] = useState(initialValue ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setStatus("saving");
    const result = await updateDesiredFutureState(goalId, field, value);
    if (result.success) {
      setStatus("saved");
      setError(null);
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Optional: in your own words, what would good look like here for your business?
      </p>
      <textarea
        className="w-full rounded border px-3 py-2 text-sm"
        rows={3}
        maxLength={1000}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus("idle");
        }}
      />
      {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={handleSave}
        disabled={status === "saving"}
        className="rounded bg-accent px-3 py-1.5 text-sm text-accent-ink disabled:opacity-40"
      >
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save"}
      </button>
    </div>
  );
}
