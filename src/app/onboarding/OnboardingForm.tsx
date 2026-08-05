"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GOAL_LABELS } from "@/lib/lenses/goals";
import type { PrimaryGoal } from "@/lib/lenses/types";
import { createCompanyAndGoal } from "./actions";

const GOAL_KEYS = Object.keys(GOAL_LABELS) as PrimaryGoal[];

export function OnboardingForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>(GOAL_KEYS[0]);
  const [urgencyLevel, setUrgencyLevel] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);

    const result = await createCompanyAndGoal({
      companyName,
      primaryGoal,
      urgencyLevel: urgencyLevel.trim() || null,
    });

    if (result.success) {
      router.push("/evidence-intake");
      router.refresh();
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Company name</span>
        <input
          type="text"
          required
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="Acme Ltd"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">What's the goal for this audit?</span>
        <select
          value={primaryGoal}
          onChange={(e) => setPrimaryGoal(e.target.value as PrimaryGoal)}
          className="w-full rounded border px-3 py-2 text-sm"
        >
          {GOAL_KEYS.map((key) => (
            <option key={key} value={key}>
              {GOAL_LABELS[key]}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">How urgent is this? (optional)</span>
        <input
          type="text"
          value={urgencyLevel}
          onChange={(e) => setUrgencyLevel(e.target.value)}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder="e.g. we need to fix this in the next month"
        />
      </label>

      {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900"
      >
        {status === "submitting" ? "Creating…" : "Continue"}
      </button>
    </form>
  );
}
