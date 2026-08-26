"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { UnifiedRequestRow, UnifiedRequestType } from "@/lib/reviewer/unified-requests";
import { TypeBadge } from "@/lib/item-type-badge";
import { humanizeStatus } from "@/lib/format";
import { Select } from "@/app/_components/ui/Select";
import { Input } from "@/app/_components/ui/Input";

// Same severity palette already used on Signals/Dashboard/the client Report
// page (confirmed 2026-08-26, navigation-audit fix batch, item 3) — kept as
// its own local copy rather than a new shared extraction, matching this
// codebase's existing convention (every one of those other files already
// keeps its own local copy too, not a prior inconsistency introduced here).
const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
};

/**
 * Client-side filtering over an already-fetched, already-normalized row
 * set (confirmed 2026-08-25) — no re-fetch per filter change, since real
 * request volume is small enough that fetching everything once and
 * filtering in-memory is simpler and faster than a server round-trip per
 * filter change.
 */

const TYPE_LABELS: Record<UnifiedRequestType, string> = {
  audit: "Core Audit",
  module: "Module",
  session: "Session / Concierge",
  sprint: "Execution Sprint",
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

export function RequestsFilterClient({ rows }: { rows: UnifiedRequestRow[] }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [companySearch, setCompanySearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const statusOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.status))).sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (severityFilter === "none" && r.severity !== null) return false;
      if (severityFilter !== "all" && severityFilter !== "none" && r.severity !== severityFilter) return false;
      if (companySearch.trim() && !r.companyName.toLowerCase().includes(companySearch.trim().toLowerCase())) return false;
      if (dateFrom && (!r.date || r.date.slice(0, 10) < dateFrom)) return false;
      if (dateTo && (!r.date || r.date.slice(0, 10) > dateTo)) return false;
      return true;
    });
  }, [rows, typeFilter, statusFilter, severityFilter, companySearch, dateFrom, dateTo]);

  return (
    <div>
      <div className="mb-4 grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-neutral-800 dark:bg-neutral-900">
        <Select label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          {(Object.entries(TYPE_LABELS) as [UnifiedRequestType, string][]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Select label="Severity" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
          <option value="all">All severities</option>
          {SEVERITY_ORDER.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="none">Not applicable</option>
        </Select>

        <Input label="Company" placeholder="Search by company name" value={companySearch} onChange={(e) => setCompanySearch(e.target.value)} />

        <div className="grid grid-cols-2 gap-2">
          <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
        {filtered.length} of {rows.length} requests
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">No requests match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="border-t border-neutral-100 dark:border-neutral-800">
                  <td className="px-3 py-2">
                    <Link href={`/company/${r.companyId}`} className="underline">
                      {r.companyName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <TypeBadge type={r.badgeType} />
                  </td>
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{humanizeStatus(r.status)}</td>
                  <td className="px-3 py-2">
                    {r.severity ? (
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLES[r.severity]}`}>
                        {r.severity}
                      </span>
                    ) : (
                      <span className="text-neutral-400 dark:text-neutral-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={r.link} className="text-xs underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
