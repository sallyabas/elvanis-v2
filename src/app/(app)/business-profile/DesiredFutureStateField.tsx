"use client";

import { useState } from "react";
import { updateDesiredFutureState } from "@/lib/goals/desired-future-state";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Button } from "@/app/_components/ui/Button";

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
    <div className="space-y-3">
      <Textarea
        label={label}
        hint="Optional: in your own words, what would good look like here for your business?"
        rows={3}
        maxLength={1000}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus("idle");
        }}
      />
      {status === "error" && error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button onClick={handleSave} disabled={status === "saving"} className="px-3 py-1.5">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save"}
      </Button>
    </div>
  );
}
