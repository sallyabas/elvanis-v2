"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FinancialImpact, Severity } from "@/lib/lenses/types";
import { formatCurrencyRange, isUsableFinancialImpact } from "@/lib/reports/financial-impact";
import { FindingNotApplicableButton } from "@/app/_components/FindingNotApplicableButton";
import { SprintInterestButton } from "@/app/_components/SprintInterestButton";
import { TYPE_BADGE_STYLES, moduleTypeToItemType } from "@/lib/item-type-badge";
import { SEVERITY_STYLES } from "@/lib/severity-badge";
import { Card } from "@/app/_components/ui/Card";
import { FilterChip } from "@/app/_components/ui/FilterChip";

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
  /**
   * Execution Sprint interest (added 2026-08-25, real gap fix — the client
   * Report page already offers "Interested in help implementing this?" per
   * finding, but this page had no way to express it, forcing a trip back
   * to the full report). Only ever set for `lens_finding` items — the
   * mechanism is scoped to the core audit only, same as the report page
   * (see sprint_interest_requests' own migration docblock), never
   * `module_finding`s. `reportId` is the finding's own report, needed by
   * SprintInterestButton; both are undefined for module findings.
   */
  reportId?: string;
  sprintInterestAlreadyRequested?: boolean;
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];
/**
 * Source-badge colors (confirmed 2026-08-26, navigation-audit fix batch,
 * item 3) — a genuinely different dimension from the item-type badges used
 * on Reports & History/Queue/Requests/Company (those distinguish which
 * DELIVERABLE something is; this distinguishes which of the 5 Core Audit
 * lenses a finding came from, a dimension that only ever appears here).
 * The 3 module sourceKeys ARE the same identity as elsewhere, so those
 * reuse `@/lib/item-type-badge`'s exact colors directly rather than
 * re-picking new ones for the same entities. The 5 lens colors are new —
 * chosen to avoid every hue already used by TYPE_BADGE_STYLES or by
 * SEVERITY_STYLES above, so a source badge is never mistaken for either.
 */
const LENS_BADGE_STYLES: Record<string, string> = {
  financial: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  execution: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  product: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  commercial: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  ai_governance: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
};

// Lens and module sourceKeys are disjoint sets (financial/execution/
// product/commercial/ai_governance vs. ai_reliability/tender_readiness/
// data_protection), so this can key off sourceKey alone — used both for
// each finding's own badge and for the Source filter chips, which only
// ever have a sourceKey, not a full SignalItem.
function sourceKeyBadgeStyle(sourceKey: string): string {
  return LENS_BADGE_STYLES[sourceKey] ?? TYPE_BADGE_STYLES[moduleTypeToItemType(sourceKey)];
}

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
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Signals</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Every finding across {companyName}&apos;s delivered Core Audit and any delivered modules, in one place —
        filter by where it came from or by severity.
      </p>

      {/* Real gap closed (confirmed 2026-09-03, direct founder feedback) —
          `sources` is deliberately data-driven (one chip per genuinely
          present source, per this file's own docblock), so with zero
          findings it correctly renders zero chips — but the "Source"
          label above them rendered unconditionally regardless, showing a
          heading for an empty control right above the "No delivered
          findings yet" message below. Adding fixed chips for
          sources/severities that don't apply yet would be misleading
          (clicking one would visibly do nothing); hiding the whole filter
          card until there's something real to filter is the honest fix —
          matches the second option offered directly. */}
      {items.length > 0 && (
        <Card className="mb-6">
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Source</p>
            <div className="flex flex-wrap gap-1.5">
              {sources.map(([key, label]) => (
                <FilterChip key={key} label={label} active={activeSources.has(key)} activeClassName={sourceKeyBadgeStyle(key)} onClick={() => toggleSource(key)} />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">Severity</p>
            <div className="flex flex-wrap gap-1.5">
              {SEVERITY_ORDER.map((s) => (
                <FilterChip key={s} label={s} active={activeSeverities.has(s)} activeClassName={SEVERITY_STYLES[s]} onClick={() => toggleSeverity(s)} />
              ))}
            </div>
          </div>
        </Card>
      )}

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
                  : "rounded-lg border border-neutral-200 bg-white p-4 text-sm shadow-card-1 dark:border-neutral-800 dark:bg-neutral-900"
              }
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span className={`rounded-full px-2 py-0.5 font-medium ${sourceKeyBadgeStyle(item.sourceKey)}`}>{item.sourceLabel}</span>
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
                  <span className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
                    {formatCurrencyRange(item.financialImpact.impactBandLow, item.financialImpact.impactBandHigh, item.financialImpact.currency)}
                  </span>
                </p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <Link href={item.detailHref} className="text-xs font-medium text-accent hover:underline">
                  View full detail
                </Link>
              </div>
              {/* Same gating as the client Report page (added 2026-08-25,
                  real gap fix): critical/high severity, not a missing-
                  evidence placeholder, and — the part specific to this
                  cross-source list — only ever a real lens_finding with a
                  reportId, never a module_finding. */}
              {item.source === "lens_finding" &&
                item.reportId &&
                !item.isMissingDataFinding &&
                (item.severity === "critical" || item.severity === "high") && (
                  <SprintInterestButton
                    companyId={companyId}
                    reportId={item.reportId}
                    findingId={item.id}
                    alreadyRequested={item.sprintInterestAlreadyRequested ?? false}
                  />
                )}
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
