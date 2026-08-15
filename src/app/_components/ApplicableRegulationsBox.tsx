import type { ReactNode } from "react";

/**
 * Shared applicability display for Tender Readiness and Data Protection
 * Compliance's intake pages (confirmed 2026-08-15, real copy/hierarchy
 * bugs found in live testing) — closes two real gaps together, and
 * prevents the two near-identical copies this was extracted from
 * drifting apart again:
 *
 * 1. The heading previously read "Applicable jurisdictions/regulations
 *    (determined automatically, not something you select)" — internal
 *    engineering framing shown directly to the client. Rewritten as
 *    plain client-facing copy.
 * 2. A regulation name (e.g. "EU AI Act (4-tier risk classification)")
 *    was reading as the page's headline rather than supporting detail
 *    within the real service ("Tender Readiness"/"Data Protection
 *    Compliance", each page's own <h1>). Fixed by demoting this whole
 *    block's typography — a small uppercase eyebrow-style heading (not
 *    a competing <h2>), each regulation name at normal body weight (not
 *    bold), and the verbose technical descriptor (e.g. "4-tier risk
 *    classification") moved out of the primary label into small, muted
 *    supporting text, rather than baked into one long parenthetical
 *    string.
 */
export interface ApplicableRegulationItem {
  label: string;
  detail?: string;
}

export function ApplicableRegulationsBox({
  items,
  noneContent,
  footnote,
}: {
  items: ApplicableRegulationItem[];
  noneContent: ReactNode;
  footnote?: ReactNode;
}) {
  return (
    <section className="mb-8">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
        Which regulations apply to you, based on your Business Profile
      </p>
      {items.length === 0 ? (
        <div className="text-sm text-neutral-500 dark:text-neutral-400">{noneContent}</div>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.label} className="text-sm text-neutral-700 dark:text-neutral-300">
              {item.label}
              {item.detail && <span className="text-neutral-400 dark:text-neutral-500"> — {item.detail}</span>}
            </li>
          ))}
        </ul>
      )}
      {footnote && <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">{footnote}</p>}
    </section>
  );
}
