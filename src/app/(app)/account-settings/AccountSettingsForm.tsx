"use client";

import { useState } from "react";
import { updateAccountSettings, type NotificationPreferences } from "./actions";
import { Input } from "@/app/_components/ui/Input";
import { Button } from "@/app/_components/ui/Button";

export function AccountSettingsForm({ initialName, initialPreferences }: { initialName: string; initialPreferences: NotificationPreferences }) {
  const [name, setName] = useState(initialName);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setStatus("saving");
    setError(null);
    const result = await updateAccountSettings(name, preferences);
    if (result.success) {
      setStatus("saved");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="space-y-4">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />

      <div>
        <span className="mb-2 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Notification preferences</span>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={preferences.reportReady}
              onChange={(e) => setPreferences((p) => ({ ...p, reportReady: e.target.checked }))}
            />
            Email me when a report is ready
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={preferences.reAuditReminder}
              onChange={(e) => setPreferences((p) => ({ ...p, reAuditReminder: e.target.checked }))}
            />
            Email me re-audit reminders
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={preferences.evidenceIncomplete}
              onChange={(e) => setPreferences((p) => ({ ...p, evidenceIncomplete: e.target.checked }))}
            />
            Email me if my evidence submission stalls
          </label>
        </div>
      </div>

      {status === "error" && error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {status === "saved" && <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>}

      <Button onClick={handleSave} disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
