"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { chooseEntryPath } from "@/app/onboarding/actions";
import { Select } from "@/app/_components/ui/Select";
import { Alert } from "@/app/_components/ui/Alert";

const LABELS: Record<string, string> = {
  diagnosis: "Business Diagnosis",
  ai_audit: "AI Compliance Audit",
  undecided: "Not sure — show me both",
};

/**
 * Real entry_path editor (confirmed 2026-08-27, Onboarding Architecture &
 * Path Routing brief, Part 1 — "can be changed later"). Deliberately does
 * not touch anything else: switching this never retroactively alters
 * delivered reports (nothing in reports/module_requests references
 * entry_path at all), and the Dashboard's own per-path fallback state
 * (Part 5 refinement — path-specific activity, not any activity) already
 * handles "switched paths, nothing there yet" honestly without this
 * component needing to know about it.
 *
 * Relocated 2026-08-31 (direct founder decision) from Account Settings to
 * Business Profile, near the goal fields — "what are you here for" is
 * conceptually the same category as the goal fields (what the business
 * wants from the platform), not personal account identity, which is what
 * Account Settings is actually for. A pure relocation, not a functional
 * change: same dropdown, same copy, same chooseEntryPath() call — only the
 * import path and the page it's rendered from changed.
 */
export function EntryPathSetting({ companyId, currentEntryPath }: { companyId: string; currentEntryPath: string }) {
  const router = useRouter();
  const [value, setValue] = useState(currentEntryPath);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: string) {
    setValue(next);
    setStatus("saving");
    setError(null);
    try {
      const result = await chooseEntryPath(companyId, next as "diagnosis" | "ai_audit" | "undecided");
      if (result.success) {
        setStatus("idle");
        router.refresh();
      } else {
        setStatus("error");
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setError("Something went wrong reaching the server — please try again.");
    }
  }

  return (
    <div>
      <Select label="What are you here for?" value={value} onChange={(e) => handleChange(e.target.value)} disabled={status === "saving"}>
        {Object.entries(LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Select>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        Changes what your Dashboard leads with. Never alters a report you&apos;ve already received.
      </p>
      {status === "error" && error && (
        <Alert variant="error" className="mt-2">
          {error}
        </Alert>
      )}
    </div>
  );
}
