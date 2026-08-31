"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GOAL_LABELS, GOAL_DESCRIPTIONS, GOAL_METRIC_EXAMPLES } from "@/lib/lenses/goals";
import type { PrimaryGoal } from "@/lib/lenses/types";
import { ALL_METRIC_DEFINITIONS, findMetricDefinition } from "@/lib/lenses/metric-direction";
import { createCompanyAndGoal, addGoalToExistingCompany } from "./actions";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Select } from "@/app/_components/ui/Select";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";

/**
 * Multi-step onboarding wizard (confirmed 2026-08-05) — replaces the
 * previous single flat form. Converges three related, previously-separate
 * pieces of work into one build: the spec's own "Multi-step guided
 * workflow" (marked "moved to V1" in the spec doc back on an earlier pass,
 * but never actually implemented — confirmed by grepping CLAUDE.md for any
 * record of it), "Cleaner onboarding polish" (pulled forward from V2), and
 * "Goal definition wizard" (also pulled forward from V2) — all three
 * describe the same underlying UX: replace the flat company+goal form with
 * a real guided flow that also captures the full `GoalContext` shape every
 * lens already reads (secondaryGoal/targetMetric/timeHorizon/
 * successDefinition), not just primaryGoal+urgencyLevel.
 *
 * Deliberately does NOT touch desiredFutureStatePrimary/Secondary — that
 * has its own dedicated, already-built capture mechanism on the Business
 * Profile page (spec §1.9a: "one capture mechanism only"), not duplicated
 * here.
 *
 * Extended 2026-08-27 (Onboarding Architecture & Path Routing brief, Parts
 * 1-3) — this is now Path A's onboarding, reached two ways:
 * - `mode="create"` (default): a brand-new pick of "Business Diagnosis" on
 *   the entry-path routing screen. Step 0 collects the real Part-2 minimal
 *   profile (company name, industry, employee count) and creates the
 *   company + goal together via createCompanyAndGoal().
 * - `mode="attach"`: this wizard is being reached either (a) via the Hub
 *   screen, where a company already exists with entry_path='undecided'
 *   (created by createCompanyMinimal() — name already known, just not
 *   industry/employee count), or (b) via Path B's "No/exploring" AI-usage
 *   triage fork (founder-confirmed decision: honestly "Path A, entered via
 *   Path B") — a company already exists with entry_path='ai_audit' and its
 *   own 5 fields already collected, so industry/employee count are already
 *   known too and step 0 is skipped entirely. Both attach cases end by
 *   calling addGoalToExistingCompany() instead of creating a new company.
 */

const GOAL_KEYS = Object.keys(GOAL_LABELS) as PrimaryGoal[];

// Structured goal-metric capture (confirmed 2026-08-13, item 2 of the
// old-Elvanis-inspired batch) — grouped by lens for the dropdown, same
// order EVIDENCE_FIELD_SETS/ALL_METRIC_DEFINITIONS already use.
const METRIC_LENS_LABELS: Record<"financial" | "execution" | "product" | "commercial", string> = {
  financial: "Financial",
  execution: "Execution / Operating",
  product: "Product / Customer",
  commercial: "Commercial / Market",
};

export interface OnboardingWizardProps {
  mode?: "create" | "attach";
  /** Required when mode="attach" — the company's own known industry/employee count only need collecting if `skipCompanyDetails` is false (Path B's fork already has them). */
  existingCompanyId?: string;
  existingCompanyName?: string;
  /** True only for Path B's fork, where industry/employee count are already known — skips straight to goal selection. */
  skipCompanyDetails?: boolean;
}

// Named step keys, not raw indices (confirmed 2026-08-27, fixing a real
// bug found live: the original hand-computed step-offset arithmetic for
// the skipCompanyDetails case was inverted, so the Goal step's render
// condition could never match and the wizard rendered a progress bar with
// no content at all). Every render/enable/back-button check keys off
// `stepKeys[stepIndex]` directly instead of arithmetic on numeric
// indices — the array itself is the only place "which steps exist, in
// what order" is decided.
type StepKey = "company" | "goal" | "refine" | "details" | "review";
const FULL_STEPS: StepKey[] = ["company", "goal", "refine", "details", "review"];
const SKIP_COMPANY_STEPS: StepKey[] = ["goal", "refine", "details", "review"];
const STEP_TITLES: Record<StepKey, string> = { company: "Company", goal: "Goal", refine: "Refine", details: "Details", review: "Review" };

export function OnboardingWizard({ mode = "create", existingCompanyId, existingCompanyName, skipCompanyDetails = false }: OnboardingWizardProps) {
  const router = useRouter();

  const stepKeys = skipCompanyDetails ? SKIP_COMPANY_STEPS : FULL_STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = stepKeys[stepIndex];

  const [companyName, setCompanyName] = useState(existingCompanyName ?? "");
  const [yourName, setYourName] = useState("");
  const [industry, setIndustry] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null);
  const [secondaryGoal, setSecondaryGoal] = useState<PrimaryGoal | "">("");
  const [urgencyLevel, setUrgencyLevel] = useState("");
  const [targetMetric, setTargetMetric] = useState("");
  const [targetMetricKey, setTargetMetricKey] = useState("");
  const [targetMetricValue, setTargetMetricValue] = useState("");
  const [timeHorizon, setTimeHorizon] = useState("");
  const [successDefinition, setSuccessDefinition] = useState("");

  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const canProceedFromCompany =
    skipCompanyDetails || (industry.trim().length > 0 && employeeCount.trim().length > 0 && (mode === "attach" || companyName.trim().length > 0));
  const canProceedFromGoal = primaryGoal !== null;

  function next() {
    setError(null);
    setStepIndex((i) => Math.min(i + 1, stepKeys.length - 1));
  }
  function back() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit() {
    if (!primaryGoal) return;

    if (targetMetricKey && !targetMetricValue.trim()) {
      setError("Enter a target value for the metric you selected.");
      return;
    }
    if (targetMetricValue.trim() && !targetMetricKey) {
      setError("Select which metric that target value is for.");
      return;
    }
    const parsedTargetMetricValue = targetMetricValue.trim() ? Number(targetMetricValue) : null;
    if (targetMetricValue.trim() && (parsedTargetMetricValue === null || Number.isNaN(parsedTargetMetricValue))) {
      setError("Target value must be a number.");
      return;
    }

    setStatus("submitting");
    setError(null);

    const goalFields = {
      primaryGoal,
      secondaryGoal: secondaryGoal || null,
      urgencyLevel: urgencyLevel.trim() || null,
      targetMetric: targetMetric.trim() || null,
      targetMetricKey: targetMetricKey || null,
      targetMetricValue: parsedTargetMetricValue,
      timeHorizon: timeHorizon.trim() || null,
      successDefinition: successDefinition.trim() || null,
    };

    const result =
      mode === "attach" && existingCompanyId
        ? await addGoalToExistingCompany({
            companyId: existingCompanyId,
            ...(skipCompanyDetails ? {} : { industry: industry.trim() || null, employeeCount: employeeCount.trim() ? Number(employeeCount) : null }),
            ...goalFields,
          })
        : await createCompanyAndGoal({
            companyName,
            yourName: yourName.trim() || null,
            industry: industry.trim() || null,
            employeeCount: employeeCount.trim() ? Number(employeeCount) : null,
            ...goalFields,
          });

    if (result.success) {
      // Real bug found and fixed live 2026-08-07: router.refresh() called
      // immediately after router.push() raced with the push's own
      // navigation and left the wizard stuck on "Creating..." forever —
      // push() alone is sufficient since every target page is already
      // fully dynamic.
      router.push("/evidence-intake");
    } else {
      setStatus("error");
      setError(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div>
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="mb-1.5 flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <span>
            Step {stepIndex + 1} of {stepKeys.length}: {STEP_TITLES[currentStep]}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${((stepIndex + 1) / stepKeys.length) * 100}%` }}
          />
        </div>
      </div>

      {currentStep === "company" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Tell us about your business</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Just enough to get started — everything else can wait.</p>
          </div>
          {mode === "attach" ? (
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              Continuing for <span className="font-medium">{existingCompanyName}</span>
            </p>
          ) : (
            <>
              <Input label="Company name" type="text" required autoFocus value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Ltd" />
              {/* Real gap closed (confirmed 2026-08-31, direct founder
                  investigation request) — this app never captured a
                  client's own name anywhere before this; users.name
                  existed on the schema since the first migration but was
                  only ever set later, manually, via Account Settings.
                  Optional — never required to proceed, matching this
                  step's own "just enough to get started" framing. */}
              <Input
                label="Your name"
                type="text"
                value={yourName}
                onChange={(e) => setYourName(e.target.value)}
                placeholder="e.g. Alex Chen"
                hint="Optional — how we'll address you."
              />
            </>
          )}
          <Input label="Industry" type="text" required value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. B2B SaaS — marketing analytics" />
          <Input label="Employee count" type="number" required value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} placeholder="e.g. 45" />
        </div>
      )}

      {currentStep === "goal" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">What are you trying to achieve?</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Pick the goal that matters most right now — every lens weighs its findings against this.
            </p>
          </div>
          <div className="space-y-2">
            {GOAL_KEYS.map((key) => (
              <label
                key={key}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-md border bg-white px-3 py-2.5 text-sm transition-all dark:bg-neutral-900 ${
                  primaryGoal === key
                    ? "border-accent bg-[#fffbf0] shadow-card-2 dark:border-accent dark:bg-accent/10"
                    : "border-neutral-200 shadow-card-1 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="primaryGoal"
                    checked={primaryGoal === key}
                    onChange={() => setPrimaryGoal(key)}
                    className="accent-accent"
                  />
                  {GOAL_LABELS[key]}
                </span>
                <span className="pl-5 text-xs text-neutral-500 dark:text-neutral-400">{GOAL_DESCRIPTIONS[key]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {currentStep === "refine" && primaryGoal && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Refine your goal (optional)</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              The more specific you are, the more targeted your findings will be — but none of this is required to continue.
            </p>
          </div>
          <Input
            label="What metric would you use to measure this?"
            type="text"
            value={targetMetric}
            onChange={(e) => setTargetMetric(e.target.value)}
            placeholder={GOAL_METRIC_EXAMPLES[primaryGoal]}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Track a specific number for this? (optional)"
              hint="If you pick one, we'll show its trend across future audits."
              value={targetMetricKey}
              onChange={(e) => setTargetMetricKey(e.target.value)}
            >
              <option value="">Don&apos;t track a specific number</option>
              {(["financial", "execution", "product", "commercial"] as const).map((lens) => (
                <optgroup key={lens} label={METRIC_LENS_LABELS[lens]}>
                  {ALL_METRIC_DEFINITIONS.filter((m) => m.lens === lens).map((m) => (
                    <option key={m.metricKey} value={m.metricKey}>
                      {m.label}
                      {m.unit ? ` (${m.unit})` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
            <Input
              label="Target value"
              type="number"
              value={targetMetricValue}
              onChange={(e) => setTargetMetricValue(e.target.value)}
              disabled={!targetMetricKey}
              placeholder={targetMetricKey ? `e.g. ${findMetricDefinition(targetMetricKey)?.unit === "%" ? "70" : "10"}` : "Pick a metric first"}
            />
          </div>
          <Input
            label="What's your time horizon?"
            type="text"
            value={timeHorizon}
            onChange={(e) => setTimeHorizon(e.target.value)}
            placeholder="e.g. next quarter, 6 months"
          />
          <Textarea
            label="What would success look like?"
            value={successDefinition}
            onChange={(e) => setSuccessDefinition(e.target.value)}
            rows={3}
            placeholder="In your own words — this helps the reviewer understand what 'done' means to you."
          />
        </div>
      )}

      {currentStep === "details" && primaryGoal && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">A couple more details (optional)</h2>
          </div>
          <Select label="Is there a secondary goal?" value={secondaryGoal} onChange={(e) => setSecondaryGoal(e.target.value as PrimaryGoal | "")}>
            <option value="">None</option>
            {GOAL_KEYS.filter((key) => key !== primaryGoal).map((key) => (
              <option key={key} value={key}>
                {GOAL_LABELS[key]}
              </option>
            ))}
          </Select>
          <Input
            label="How urgent is this?"
            type="text"
            value={urgencyLevel}
            onChange={(e) => setUrgencyLevel(e.target.value)}
            placeholder="e.g. we need to fix this in the next month"
          />
        </div>
      )}

      {currentStep === "review" && primaryGoal && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Review</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Everything here can be changed later from Business Profile.</p>
          </div>
          <dl className="space-y-3 rounded-md border border-neutral-200 bg-white p-4 text-sm shadow-card-1 dark:border-neutral-700 dark:bg-neutral-900">
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-400">Company</dt>
              <dd>{companyName || existingCompanyName}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-400">Primary goal</dt>
              <dd>{GOAL_LABELS[primaryGoal]}</dd>
            </div>
            {secondaryGoal && (
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-400">Secondary goal</dt>
                <dd>{GOAL_LABELS[secondaryGoal]}</dd>
              </div>
            )}
            {targetMetric && (
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-400">Target metric</dt>
                <dd>{targetMetric}</dd>
              </div>
            )}
            {targetMetricKey && targetMetricValue && (
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-400">Tracking</dt>
                <dd>
                  {findMetricDefinition(targetMetricKey)?.label} → target {targetMetricValue}
                  {findMetricDefinition(targetMetricKey)?.unit}
                </dd>
              </div>
            )}
            {timeHorizon && (
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-400">Time horizon</dt>
                <dd>{timeHorizon}</dd>
              </div>
            )}
            {successDefinition && (
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-400">Success looks like</dt>
                <dd>{successDefinition}</dd>
              </div>
            )}
            {urgencyLevel && (
              <div>
                <dt className="text-xs font-medium uppercase text-neutral-400">Urgency</dt>
                <dd>{urgencyLevel}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {status === "error" && error && (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      )}

      <div className="mt-6 flex gap-2">
        {stepIndex > 0 && (
          <Button type="button" variant="secondary" onClick={back} disabled={status === "submitting"}>
            Back
          </Button>
        )}
        {stepIndex < stepKeys.length - 1 ? (
          <Button
            type="button"
            onClick={next}
            disabled={(currentStep === "company" && !canProceedFromCompany) || (currentStep === "goal" && !canProceedFromGoal)}
            className="flex-1"
          >
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={status === "submitting"} className="flex-1">
            {status === "submitting" ? "Creating…" : "Get started"}
          </Button>
        )}
      </div>
    </div>
  );
}
