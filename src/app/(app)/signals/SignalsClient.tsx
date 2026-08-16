"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FinancialImpact, Severity } from "@/lib/lenses/types";
import { formatCurrencyRange, isUsableFinancialImpact } from "@/lib/reports/financial-impact";
import { FindingNotApplicableButton } from "@/app/_components/FindingNotApplicableButton";
import { Card } from "@/app/_components/ui/Card";

export interface SignalItem {
  id: string;
  source: "lens_finding" | "module_finding";
  /** lens key or module_type key, for the filter chips' stable identity — sourceLabel is the display text. */
  sourceKey: string;
  sourceLabel: string;
  title: string;
  diagnosis: string;
  recommendedAction: string;
  severity: Severity;
  isMissingDataFinding: boolean;
  financialImpact: FinancialImpact | null;
  detailHref: string;
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];
const SEVERITY_STYLES: Record<Severity, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

export function SignalsClient({
  companyId,
  companyName,
  items,
  flaggedIds,
}: {
  companyId: string;
  companyName: string;
  items: SignalItem[];
  flaggedIds: string[];
}) {
  const flagged = useMemo(() => new Set(flaggedIds), [flaggedIds]);

  // Real filter chips, one per genuinely present source (never a chip for
  // a lens/module with zero findings) — sourceKey is the stable filter
  // identity, sourceLabel is what's shown.
  const sources = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) map.set(item.sourceKey, item.sourceLabel);
    return [...map.entries()];
  }, [items]);

  const [activeSources, setActiveSources] = useState<Set<string>>(() => new Set(sources.map(([key]) => key)));
  const [activeSeverities, setActiveSeverities] = useState<Set<Severity>>(() => new Set(SEVERITY_ORDER));

  function toggleSource(key: string) {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSeverity(s: Severity) {
    setActiveSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const filtered = items
    .filter((i) => activeSources.has(i.sourceKey) && activeSeverities.has(i.severity))
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Signals</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Every finding across {companyName}&apos;s delivered Core Audit and any delivered modules, in one place —
        filter by where it came from or by severity.
      </p>

      <Card className="mb-6">
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Source</p>
          <div className="flex flex-wrap gap-1.5">
            {sources.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleSource(key)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeSources.has(key)
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-neutral-300 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Severity</p>
          <div className="flex flex-wrap gap-1.5">
            {SEVERITY_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSeverity(s)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  activeSeverities.has(s)
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-neutral-300 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          No delivered findings yet — this fills in once your Core Audit or a module is delivered.
        </p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No findings match the current filters.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((item) => (
            <li
              key={item.id}
              className={
                item.isMissingDataFinding
                  ? "rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900/50"
                  : "rounded-lg border border-neutral-200 bg-white p-4 text-sm shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
              }
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {item.sourceLabel}
                </span>
                {item.isMissingDataFinding ? (
                  <span className="rounded bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    No evidence submitted
                  </span>
                ) : (
                  <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLES[item.severity]}`}>
                    {item.severity}
                  </span>
                )}
              </div>
              <p className="font-medium text-neutral-900 dark:text-neutral-50">{item.title}</p>
              <p className="mt-1 text-neutral-600 dark:text-neutral-400">{item.diagnosis}</p>
              {!item.isMissingDataFinding && (
                <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">Recommended: </span>
                  {item.recommendedAction}
                </p>
              )}
              {isUsableFinancialImpact(item.financialImpact) && (
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Estimated impact:{" "}
                  {formatCurrencyRange(item.financialImpact.impactBandLow, item.financialImpact.impactBandHigh, item.financialImpact.currency)}
                </p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <Link href={item.detailHref} className="text-xs font-medium text-accent underline hover:text-accent-hover">
                  View full detail
                </Link>
              </div>
              {!item.isMissingDataFinding && (
                <FindingNotApplicableButton
                  companyId={companyId}
                  findingSource={item.source}
                  findingId={item.id}
                  findingTitle={item.title}
                  alreadyFlagged={flagged.has(item.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
