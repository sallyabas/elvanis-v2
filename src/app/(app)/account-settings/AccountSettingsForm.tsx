"use client";

import { useState } from "react";
import { updateAccountSettings, type NotificationPreferences } from "./actions";
import { PER_TYPE_PREFERENCE_KEYS, PREFERENCE_LABELS } from "@/lib/notifications/preferences";
import { Input } from "@/app/_components/ui/Input";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

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
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="How we'll address you in emails and reports" />

      <div>
        {/* Widened 2026-09-03 (email redesign brief) from 3 hand-written
            checkboxes to a data-driven list over every real client-facing
            event type, plus a real master opt-out — the same key the
            /unsubscribe flow's "unsubscribe from everything" link sets,
            reversible from here so a client isn't permanently stuck. */}
        <span className="mb-2 block text-sm font-medium text-neutral-800 dark:text-neutral-200">Notification preferences</span>
        <div className="space-y-2">
          {PER_TYPE_PREFERENCE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 text-sm text-neutral-800 dark:text-neutral-200">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent"
                checked={preferences[key]}
                disabled={preferences.optedOutOfAll}
                onChange={(e) => setPreferences((p) => ({ ...p, [key]: e.target.checked }))}
              />
              Email me: {PREFERENCE_LABELS[key]}
            </label>
          ))}
        </div>

        <div className="mt-4 rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">
            <input
              type="checkbox"
              className="h-4 w-4 accent-accent"
              checked={preferences.optedOutOfAll}
              onChange={(e) => setPreferences((p) => ({ ...p, optedOutOfAll: e.target.checked }))}
            />
            Unsubscribe from all Elvanis emails
          </label>
          <p className="mt-1 pl-6 text-xs text-neutral-500 dark:text-neutral-400">Overrides every toggle above — the individual choices are kept, just not used, so unchecking this restores them.</p>
        </div>
      </div>

      {status === "error" && error && <Alert variant="error">{error}</Alert>}
      {status === "saved" && <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>}

      <Button onClick={handleSave} disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
