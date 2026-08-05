"use client";

import { useState } from "react";
import { updateAccountSettings, type NotificationPreferences } from "./actions";

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
      <label className="block space-y-1">
        <span className="text-sm font-medium">Name</span>
        <input className="w-full rounded border px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div>
        <span className="mb-2 block text-sm font-medium">Notification preferences</span>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.reportReady}
              onChange={(e) => setPreferences((p) => ({ ...p, reportReady: e.target.checked }))}
            />
            Email me when a report is ready
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.reAuditReminder}
              onChange={(e) => setPreferences((p) => ({ ...p, reAuditReminder: e.target.checked }))}
            />
            Email me re-audit reminders
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={preferences.evidenceIncomplete}
              onChange={(e) => setPreferences((p) => ({ ...p, evidenceIncomplete: e.target.checked }))}
            />
            Email me if my evidence submission stalls
          </label>
        </div>
      </div>

      {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}
      {status === "saved" && <p className="text-sm text-green-600">Saved.</p>}

      <button
        onClick={handleSave}
        disabled={status === "saving"}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900"
      >
        {status === "saving" ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
