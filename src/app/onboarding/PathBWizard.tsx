"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/app/_components/ui/Input";
import { Select } from "@/app/_components/ui/Select";
import { TagInput } from "@/app/_components/ui/TagInput";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";
import { EU_COUNTRIES, OTHER_COUNTRY_SENTINEL, KNOWN_COUNTRIES } from "@/lib/onboarding/registration-country-options";
import { submitPathBMinimalProfile, submitTriageAnswers, requestComplianceConsultation } from "./path-b-actions";
import type { PathBRoutingResult, TriageAiUsage, TriageComplianceRequest, TriagePersonalData } from "@/lib/onboarding/path-b-routing";
import { MODULE_META } from "@/lib/modules/module-meta";
import { OnboardingWizard } from "./OnboardingWizard";

/**
 * Path B onboarding — confirmed 2026-08-27, Onboarding Architecture &
 * Path Routing brief, Part 3, extended same day with the founder's own
 * third-question refinement. Three real screens, in order:
 * 1. Minimal profile (5 fields — company name/industry/employee count are
 *    generic, registration jurisdiction + customer markets are Path-B-
 *    specific and structurally required for Tender Readiness's own
 *    jurisdiction determination, per Part 8a).
 * 2. Triage (3 separate questions, shown as their own screen per the
 *    brief's explicit "these are routing decisions, not data collection"
 *    framing).
 * 3. Recommendation — the deterministic routing result (computePathBRouting)
 *    shown with its real reasoning before acting on it, not a silent
 *    forced redirect; the client explicitly proceeds from here.
 */

export interface PathBWizardProps {
  mode?: "create" | "attach";
  existingCompanyId?: string;
  existingCompanyName?: string;
  /**
   * Resume directly at the triage screen — confirmed 2026-08-28, the fix
   * for the real "stranded" dead-end: used when returning to a Path B
   * company whose 5-field profile is already saved (entry_path='ai_audit'
   * already committed) but whose triage/recommendation steps were
   * interrupted. Per the founder's own confirmed decision, this does NOT
   * restore any previously-answered (and lost) triage answers — it only
   * skips the already-complete profile step, so the client re-answers the
   * 3 short questions rather than being asked to re-enter their whole
   * profile again.
   */
  startAtTriage?: boolean;
}

const AI_USAGE_OPTIONS: { value: TriageAiUsage; label: string }[] = [
  { value: "customer_facing", label: "Yes — customers interact with it directly" },
  { value: "internal_only", label: "Yes — internal use only, not customer-facing" },
  { value: "exploring", label: "No — we're exploring or planning" },
  { value: "not_sure", label: "Not sure" },
];

const COMPLIANCE_REQUEST_OPTIONS: { value: TriageComplianceRequest; label: string }[] = [
  { value: "active_request", label: "Yes — I have an active request to respond to" },
  { value: "want_ahead", label: "No — but I want to get ahead of this" },
  { value: "not_applicable", label: "Not applicable" },
];

const PERSONAL_DATA_OPTIONS: { value: TriagePersonalData; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_sure", label: "Not sure" },
];

export function PathBWizard({ mode = "create", existingCompanyId, existingCompanyName, startAtTriage = false }: PathBWizardProps) {
  const router = useRouter();
  const [screen, setScreen] = useState<"profile" | "triage" | "recommendation" | "core_audit_fork">(startAtTriage ? "triage" : "profile");
  const [companyId, setCompanyId] = useState<string | undefined>(existingCompanyId);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Profile fields
  const [companyName, setCompanyName] = useState(existingCompanyName ?? "");
  const [industry, setIndustry] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [registrationCountry, setRegistrationCountry] = useState("");
  const [uaeFreeZone, setUaeFreeZone] = useState<"mainland" | "difc" | "adgm" | "">("");
  const [customerMarketCountries, setCustomerMarketCountries] = useState<string[]>([]);

  // Triage answers
  const [aiUsage, setAiUsage] = useState<TriageAiUsage | "">("");
  const [complianceRequest, setComplianceRequest] = useState<TriageComplianceRequest | "">("");
  const [personalData, setPersonalData] = useState<TriagePersonalData | "">("");

  const [routing, setRouting] = useState<PathBRoutingResult | null>(null);

  const isKnownCountry = !registrationCountry || KNOWN_COUNTRIES.includes(registrationCountry);
  const isUae = registrationCountry === "United Arab Emirates";

  const canSubmitProfile =
    (mode === "attach" || companyName.trim().length > 0) && industry.trim().length > 0 && employeeCount.trim().length > 0 && registrationCountry.trim().length > 0;

  async function handleSubmitProfile() {
    setPending(true);
    setError(null);
    try {
      const result = await submitPathBMinimalProfile({
        existingCompanyId,
        companyName: mode === "attach" ? undefined : companyName,
        industry,
        employeeCount: Number(employeeCount),
        registrationCountry,
        uaeFreeZone: uaeFreeZone || null,
        customerMarketCountries,
      });
      if (result.success && result.companyId) {
        setCompanyId(result.companyId);
        setScreen("triage");
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleSubmitTriage() {
    if (!companyId || !aiUsage || !complianceRequest || !personalData) return;
    setPending(true);
    setError(null);
    try {
      const result = await submitTriageAnswers({ companyId, aiUsage, complianceRequest, personalData });
      if (result.success && result.routing) {
        setRouting(result.routing);
        setScreen("recommendation");
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleProceed() {
    if (!routing || !companyId) return;
    if (routing.primary.kind === "module") {
      router.push(MODULE_META[routing.primary.module].routePath);
      return;
    }
    if (routing.primary.kind === "core_audit") {
      setScreen("core_audit_fork");
      return;
    }
    // consultation
    setPending(true);
    setError(null);
    try {
      const result = await requestComplianceConsultation(companyId, routing.primary.urgent);
      if (result.success) {
        router.push("/dashboard");
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  if (screen === "core_audit_fork" && companyId) {
    // Founder-confirmed decision: "No/exploring" is honestly "Path A,
    // entered via Path B" — reuse the exact goal-selection step rather
    // than inventing a new one. Industry/employee count are already known
    // from this wizard's own profile step, so skip re-asking.
    return (
      <div>
        <div className="mb-6">
          <Alert variant="info">
            No AI in production yet — let&apos;s run a full business diagnosis instead, which includes an AI & Governance
            assessment as one of its five lenses.
          </Alert>
        </div>
        <OnboardingWizard mode="attach" existingCompanyId={companyId} existingCompanyName={companyName || existingCompanyName} skipCompanyDetails />
      </div>
    );
  }

  if (screen === "recommendation" && routing) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Here&apos;s what we&apos;d recommend</h1>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-card-2 border-l-4 border-l-accent dark:border-neutral-700 dark:bg-neutral-900">
          <p className="font-medium text-neutral-900 dark:text-neutral-50">
            {routing.primary.kind === "module"
              ? MODULE_META[routing.primary.module].label
              : routing.primary.kind === "consultation"
                ? "A conversation with your reviewer"
                : "A full business diagnosis"}
            {"urgent" in routing.primary && routing.primary.urgent && (
              <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:bg-red-950 dark:text-red-300">
                Urgent
              </span>
            )}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {routing.primary.kind === "module" || routing.primary.kind === "consultation" ? routing.primary.reason : routing.primary.reason}
          </p>
        </div>
        {routing.additional.map((rec, i) => (
          <div key={i} className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/50">
            <p className="font-medium text-neutral-900 dark:text-neutral-50">{rec.kind === "module" ? MODULE_META[rec.module].label : ""}</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{rec.reason}</p>
          </div>
        ))}
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="button" onClick={handleProceed} disabled={pending} className="w-full">
          {pending ? "One moment…" : "Continue"}
        </Button>
      </div>
    );
  }

  if (screen === "triage") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">A couple of quick questions</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">These decide what happens next — not more profile fields.</p>
          {startAtTriage && existingCompanyName && (
            <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
              Continuing for <span className="font-medium">{existingCompanyName}</span> — your profile is already saved.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Are you currently using AI in any production or customer-facing workflow?</p>
          <div className="space-y-1.5">
            {AI_USAGE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-card-1 transition-all has-[:checked]:border-accent has-[:checked]:bg-[#fffbf0] has-[:checked]:shadow-card-2 dark:border-neutral-800 dark:bg-neutral-900 dark:has-[:checked]:border-accent dark:has-[:checked]:bg-accent/10">
                <input type="radio" name="aiUsage" checked={aiUsage === opt.value} onChange={() => setAiUsage(opt.value)} className="accent-accent" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Have you recently received a compliance request, investor question, enterprise customer security questionnaire, or procurement requirement about your AI?
          </p>
          <div className="space-y-1.5">
            {COMPLIANCE_REQUEST_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-card-1 transition-all has-[:checked]:border-accent has-[:checked]:bg-[#fffbf0] has-[:checked]:shadow-card-2 dark:border-neutral-800 dark:bg-neutral-900 dark:has-[:checked]:border-accent dark:has-[:checked]:bg-accent/10">
                <input
                  type="radio"
                  name="complianceRequest"
                  checked={complianceRequest === opt.value}
                  onChange={() => setComplianceRequest(opt.value)}
                  className="accent-accent"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Does your business process or store customer or employee personal data (names, emails, health, financial, or similar)?
          </p>
          <div className="space-y-1.5">
            {PERSONAL_DATA_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-card-1 transition-all has-[:checked]:border-accent has-[:checked]:bg-[#fffbf0] has-[:checked]:shadow-card-2 dark:border-neutral-800 dark:bg-neutral-900 dark:has-[:checked]:border-accent dark:has-[:checked]:bg-accent/10">
                <input type="radio" name="personalData" checked={personalData === opt.value} onChange={() => setPersonalData(opt.value)} className="accent-accent" />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <Button type="button" onClick={handleSubmitTriage} disabled={pending || !aiUsage || !complianceRequest || !personalData} className="w-full">
          {pending ? "One moment…" : "Continue"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Tell us about your business</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Registration and customer-market details are required for a real jurisdiction determination — without them, Tender
          Readiness can&apos;t tell you which regulations actually apply.
        </p>
      </div>
      {mode !== "attach" && <Input label="Company name" required autoFocus value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Ltd" />}
      {mode === "attach" && (
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          Continuing for <span className="font-medium">{existingCompanyName}</span>
        </p>
      )}
      <Input label="Industry" required value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. B2B SaaS — marketing analytics" />
      <Input label="Employee count" type="number" required value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} placeholder="e.g. 45" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Select
            label="Registration country"
            hint="Where the company is legally registered."
            value={isKnownCountry ? registrationCountry : OTHER_COUNTRY_SENTINEL}
            onChange={(e) => setRegistrationCountry(e.target.value === OTHER_COUNTRY_SENTINEL ? "" : e.target.value)}
          >
            <option value="">Select…</option>
            <option value="United Kingdom">United Kingdom</option>
            <optgroup label="European Union">
              {EU_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
            <optgroup label="Gulf">
              <option value="Saudi Arabia">Saudi Arabia</option>
              <option value="United Arab Emirates">United Arab Emirates</option>
            </optgroup>
            <option value={OTHER_COUNTRY_SENTINEL}>Other / not listed</option>
          </Select>
          {!isKnownCountry && <Input placeholder="Type the registration country" value={registrationCountry} onChange={(e) => setRegistrationCountry(e.target.value)} />}
        </div>
        {isUae ? (
          <Select label="UAE free zone (if applicable)" value={uaeFreeZone} onChange={(e) => setUaeFreeZone(e.target.value as "mainland" | "difc" | "adgm" | "")}>
            <option value="">Not set</option>
            <option value="mainland">Mainland</option>
            <option value="difc">DIFC</option>
            <option value="adgm">ADGM</option>
          </Select>
        ) : (
          <div />
        )}
      </div>
      <TagInput
        label="Customer market countries"
        hint="Press Enter after each one — where your customers are, not where you're registered."
        value={customerMarketCountries}
        onChange={setCustomerMarketCountries}
        placeholder="e.g. United Kingdom, Germany, Saudi Arabia…"
      />
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="button" onClick={handleSubmitProfile} disabled={pending || !canSubmitProfile} className="w-full">
        {pending ? "One moment…" : "Continue"}
      </Button>
    </div>
  );
}
