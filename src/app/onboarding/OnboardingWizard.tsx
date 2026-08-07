"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GOAL_LABELS, GOAL_DESCRIPTIONS, GOAL_METRIC_EXAMPLES } from "@/lib/lenses/goals";
import type { PrimaryGoal } from "@/lib/lenses/types";
import { createCompanyAndGoal } from "./actions";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Select } from "@/app/_components/ui/Select";
import { Button } from "@/app/_components/ui/Button";

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
 */

const GOAL_KEYS = Object.keys(GOAL_LABELS) as PrimaryGoal[];
const STEP_LABELS = ["Company", "Goal", "Refine", "Details", "Review"] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [companyName, setCompanyName] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null);
  const [secondaryGoal, setSecondaryGoal] = useState<PrimaryGoal | "">("");
  const [urgencyLevel, setUrgencyLevel] = useState("");
  const [targetMetric, setTargetMetric] = useState("");
  const [timeHorizon, setTimeHorizon] = useState("");
  const [successDefinition, setSuccessDefinition] = useState("");

  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const canProceedFromCompany = companyName.trim().length > 0;
  const canProceedFromGoal = primaryGoal !== null;

  function next() {
    setError(null);
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }
  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    if (!primaryGoal) return;
    setStatus("submitting");
    setError(null);

    const result = await createCompanyAndGoal({
      companyName,
      primaryGoal,
      secondaryGoal: secondaryGoal || null,
      urgencyLevel: urgencyLevel.trim() || null,
      targetMetric: targetMetric.trim() || null,
      timeHorizon: timeHorizon.trim() || null,
      successDefinition: successDefinition.trim() || null,
    });

    if (result.success) {
      // Real bug found and fixed live 2026-08-07: router.refresh() called
      // immediately after router.push() raced with the push's own
      // navigation and left the wizard stuck on "Creating..." forever —
      // the company/goal were genuinely created (confirmed via direct DB
      // read), but the client never committed the navigation to
      // /evidence-intake. push() alone is sufficient here: every target
      // page in this app is already fully dynamic (session/cookie-
      // dependent, confirmed via the build output's own `ƒ` markers), so
      // there's no stale cached RSC payload for refresh() to bust — it was
      // pure redundant risk, not a real safeguard.
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
            Step {step + 1} of {STEP_LABELS.length}: {STEP_LABELS[step]}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-neutral-900 transition-all dark:bg-white"
            style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
          />
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">What&apos;s your company called?</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">This is the name we&apos;ll use across your reports and dashboard.</p>
          </div>
          <Input
            label="Company name"
            type="text"
            required
            autoFocus
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Ltd"
          />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">What are you trying to achieve?</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Pick the goal that matters most right now — every lens weighs its findings against this.
            </p>
          </div>
          <div className="space-y-2">
            {GOAL_KEYS.map((key) => (
              <label
                key={key}
                className={`flex cursor-pointer flex-col gap-0.5 rounded border px-3 py-2.5 text-sm transition-colors ${
                  primaryGoal === key
                    ? "border-neutral-900 bg-neutral-50 dark:border-white dark:bg-neutral-900"
                    : "border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="primaryGoal"
                    checked={primaryGoal === key}
                    onChange={() => setPrimaryGoal(key)}
                    className="accent-neutral-900 dark:accent-white"
                  />
                  {GOAL_LABELS[key]}
                </span>
                <span className="pl-5 text-xs text-neutral-500 dark:text-neutral-400">{GOAL_DESCRIPTIONS[key]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 2 && primaryGoal && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Refine your goal (optional)</h2>
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

      {step === 3 && primaryGoal && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">A couple more details (optional)</h2>
          </div>
          <Select
            label="Is there a secondary goal?"
            value={secondaryGoal}
            onChange={(e) => setSecondaryGoal(e.target.value as PrimaryGoal | "")}
          >
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

      {step === 4 && primaryGoal && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Review</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Everything here can be changed later from Business Profile.</p>
          </div>
          <dl className="space-y-3 rounded-md border border-neutral-300 bg-white p-4 text-sm shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
            <div>
              <dt className="text-xs font-medium uppercase text-neutral-400">Company</dt>
              <dd>{companyName}</dd>
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

      {status === "error" && error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-6 flex gap-2">
        {step > 0 && (
          <Button type="button" variant="secondary" onClick={back} disabled={status === "submitting"}>
            Back
          </Button>
        )}
        {step < STEP_LABELS.length - 1 ? (
          <Button
            type="button"
            onClick={next}
            disabled={(step === 0 && !canProceedFromCompany) || (step === 1 && !canProceedFromGoal)}
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
