"use client";

import { useState } from "react";
import { HubScreen } from "./HubScreen";
import { OnboardingWizard } from "./OnboardingWizard";
import { PathBWizard } from "./PathBWizard";

/**
 * Resumes an existing entry_path='undecided' company straight at the Hub
 * screen (confirmed 2026-08-27, Onboarding Architecture & Path Routing
 * brief, Part 1/4/5) — reached either directly (a client re-loading
 * `/onboarding` after abandoning mid-flow before picking from the Hub) or
 * via Dashboard's own embedded Hub content for entry_path='undecided'
 * (Part 5), whose "Start with this one" buttons link back here.
 */
export function HubResume({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [chosen, setChosen] = useState<"diagnosis" | "ai_audit" | null>(null);

  if (chosen === "diagnosis") return <OnboardingWizard mode="attach" existingCompanyId={companyId} existingCompanyName={companyName} />;
  if (chosen === "ai_audit") return <PathBWizard mode="attach" existingCompanyId={companyId} existingCompanyName={companyName} />;

  return <HubScreen onChoose={setChosen} />;
}
