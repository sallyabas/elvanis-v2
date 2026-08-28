"use client";

import { useState } from "react";
import { EntryPathScreen } from "./EntryPathScreen";
import { HubScreen } from "./HubScreen";
import { OnboardingWizard } from "./OnboardingWizard";
import { PathBWizard } from "./PathBWizard";
import { createCompanyMinimal } from "./actions";
import { Input } from "@/app/_components/ui/Input";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

type Screen = "entry" | "minimal_name" | "hub" | "path_a" | "path_a_attach" | "path_b" | "path_b_attach";

/**
 * Top-level onboarding orchestrator (confirmed 2026-08-27, Onboarding
 * Architecture & Path Routing brief, Parts 1-4) — replaces the old
 * `/onboarding` page's unconditional `<OnboardingWizard />` render with
 * the new routing-screen-first flow.
 *
 * "I'm not sure yet" needs a real company row to exist before the Hub
 * screen's own entry_path=undecided choice can be stored anywhere (Part 4:
 * "the hub page does not collect any data" — but Part 1 requires
 * entry_path to already be a queryable field on a real company record by
 * the time the Hub is shown, and by the time it's later changed from
 * Account Settings). The one unavoidable field (`companies.name` is `not
 * null`) is collected in a tiny intermediate step (`minimal_name`) that
 * doesn't exist anywhere in the brief's own wireframe but is the honest,
 * minimum-possible bridge between "no data collection" and "a real row to
 * persist the choice on."
 */
export function OnboardingFlow() {
  const [screen, setScreen] = useState<Screen>("entry");
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [companyName, setCompanyName] = useState<string | undefined>(undefined);

  const [minimalName, setMinimalName] = useState("");
  const [minimalError, setMinimalError] = useState<string | null>(null);
  const [minimalPending, setMinimalPending] = useState(false);

  async function handleSubmitMinimalName() {
    setMinimalPending(true);
    setMinimalError(null);
    try {
      const result = await createCompanyMinimal({ companyName: minimalName });
      if (result.success && result.companyId) {
        setCompanyId(result.companyId);
        setCompanyName(minimalName.trim());
        setScreen("hub");
      } else {
        setMinimalError(result.error ?? "Something went wrong.");
      }
    } catch {
      setMinimalError("Something went wrong reaching the server — please try again.");
    } finally {
      setMinimalPending(false);
    }
  }

  if (screen === "entry") {
    return (
      <EntryPathScreen
        onChoose={(choice) => {
          if (choice === "diagnosis") setScreen("path_a");
          else if (choice === "ai_audit") setScreen("path_b");
          else setScreen("minimal_name");
        }}
      />
    );
  }

  if (screen === "minimal_name") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">What&apos;s your company called?</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Just this for now — we&apos;ll show you both options next.</p>
        </div>
        <Input label="Company name" required autoFocus value={minimalName} onChange={(e) => setMinimalName(e.target.value)} placeholder="Acme Ltd" />
        {minimalError && <Alert variant="error">{minimalError}</Alert>}
        <Button type="button" onClick={handleSubmitMinimalName} disabled={minimalPending || !minimalName.trim()} className="w-full">
          {minimalPending ? "One moment…" : "Continue"}
        </Button>
      </div>
    );
  }

  if (screen === "hub") {
    return <HubScreen onChoose={(path) => setScreen(path === "diagnosis" ? "path_a_attach" : "path_b_attach")} />;
  }

  if (screen === "path_a_attach") {
    return <OnboardingWizard mode="attach" existingCompanyId={companyId} existingCompanyName={companyName} />;
  }

  if (screen === "path_b_attach") {
    return <PathBWizard mode="attach" existingCompanyId={companyId} existingCompanyName={companyName} />;
  }

  if (screen === "path_b") {
    return <PathBWizard mode="create" />;
  }

  return <OnboardingWizard mode="create" />;
}
