"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TypeBadge, TYPE_BADGE_STYLES, type ItemType } from "@/lib/item-type-badge";
import { Card } from "@/app/_components/ui/Card";
import { FilterChip } from "@/app/_components/ui/FilterChip";

export interface HistoryItem {
  id: string;
  type: ItemType;
  group: "deliverable" | "session";
  subLabel: string | null;
  date: string | null;
  dateLabel: string;
  href: string | null;
  /**
   * Real reviewer-authored completion/outcome note (confirmed 2026-08-31,
   * sidebar rework item 15) — session_requests.reviewer_notes, already
   * captured by the reviewer at completion time (see the 2026-08-11
   * "Mark completed — real outcome notes" build) but never surfaced to
   * the client before this. Reuses that existing field/mechanism directly
   * — no new table, no new capture step, not just an email — rather than
   * inventing a separate "session output" concept.
   */
  reviewerNotes: string | null;
}

/**
 * Type filter chips (confirmed 2026-08-31, sidebar rework item 7) — reuses
 * the exact FilterChip component built for Signals, not a re-implementation.
 * Six categories, coarser than the underlying ItemType in one place only:
 * every session type (discovery/delivery/f2f_workshop/concierge/
 * compliance_consultation) collapses into one "Sessions" filter, since
 * that's the real distinction the founder asked for (Core Audit / Tender
 * Readiness / AI Reliability / Data Protection / Sessions / Sprints) —
 * not a 10-way split matching every individual session type.
 */
type FilterCategory = "core_audit" | "tender_readiness" | "ai_reliability" | "data_protection" | "sessions" | "sprints";

const FILTER_LABELS: Record<FilterCategory, string> = {
  core_audit: "Core Audit",
  tender_readiness: "Tender Readiness",
  ai_reliability: "AI Reliability",
  data_protection: "Data Protection",
  sessions: "Sessions",
  sprints: "Sprints",
};

const FILTER_COLORS: Record<FilterCategory, string> = {
  core_audit: TYPE_BADGE_STYLES.core_audit,
  tender_readiness: TYPE_BADGE_STYLES.tender_readiness,
  ai_reliability: TYPE_BADGE_STYLES.ai_reliability,
  data_protection: TYPE_BADGE_STYLES.data_protection,
  sessions: TYPE_BADGE_STYLES.discovery,
  sprints: TYPE_BADGE_STYLES.execution_sprint,
};

function filterCategoryFor(item: HistoryItem): FilterCategory {
  if (item.group === "session") return "sessions";
  if (item.type === "execution_sprint") return "sprints";
  return item.type as FilterCategory;
}

export function ReportsHistoryClient({ deliverables, sessions }: { deliverables: HistoryItem[]; sessions: HistoryItem[] }) {
  const allItems = useMemo(() => [...deliverables, ...sessions], [deliverables, sessions]);
  const presentCategories = useMemo(() => {
    const set = new Set<FilterCategory>();
    for (const item of allItems) set.add(filterCategoryFor(item));
    return (Object.keys(FILTER_LABELS) as FilterCategory[]).filter((c) => set.has(c));
  }, [allItems]);

  const [active, setActive] = useState<Set<FilterCategory>>(() => new Set(presentCategories));

  function toggle(category: FilterCategory) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const filteredDeliverables = deliverables.filter((item) => active.has(filterCategoryFor(item)));
  const filteredSessions = sessions.filter((item) => active.has(filterCategoryFor(item)));

  function renderItem(item: HistoryItem) {
    return (
      <li key={item.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-card-1">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <TypeBadge type={item.type} />
              {item.subLabel && <span className="text-xs font-normal text-neutral-500">{item.subLabel}</span>}
            </div>
            <div className="text-xs text-neutral-500">
              {item.dateLabel} {item.date ? new Date(item.date).toLocaleDateString() : "unknown"}
            </div>
          </div>
          {item.href && (
            <Link href={item.href} className="text-sm font-medium text-accent hover:underline">
              View
            </Link>
          )}
        </div>
        {item.reviewerNotes && (
          <div className="mt-3 rounded border-l-2 border-accent bg-[#fffbf0] p-2">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">Reviewer notes</p>
            <p className="whitespace-pre-wrap text-sm text-neutral-800">{item.reviewerNotes}</p>
          </div>
        )}
      </li>
    );
  }

  if (presentCategories.length === 0) return null;

  return (
    <div className="space-y-6">
      {presentCategories.length > 1 && (
        <Card>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">Filter</p>
          <div className="flex flex-wrap gap-1.5">
            {presentCategories.map((c) => (
              <FilterChip key={c} label={FILTER_LABELS[c]} active={active.has(c)} activeClassName={FILTER_COLORS[c]} onClick={() => toggle(c)} />
            ))}
          </div>
        </Card>
      )}

      {filteredDeliverables.length > 0 && (
        <Card title="Deliverables" subtitle="Real, reviewed output — your Core Audit, module results, and completed sprints.">
          <ul className="space-y-3">{filteredDeliverables.map(renderItem)}</ul>
        </Card>
      )}
      {filteredSessions.length > 0 && (
        <Card title="Sessions" subtitle="Calls and workshops with your reviewer.">
          <ul className="space-y-3">{filteredSessions.map(renderItem)}</ul>
        </Card>
      )}
      {filteredDeliverables.length === 0 && filteredSessions.length === 0 && (
        <p className="text-sm text-neutral-500">No items match the current filter.</p>
      )}
    </div>
  );
}
