"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { UnifiedRequestRow, UnifiedRequestType } from "@/lib/reviewer/unified-requests";
import { TypeBadge } from "@/lib/item-type-badge";
import { SEVERITY_STYLES } from "@/lib/severity-badge";
import { Select } from "@/app/_components/ui/Select";
import { Input } from "@/app/_components/ui/Input";

// Same severity palette already used on Signals/Dashboard/the client Report
// page (confirmed 2026-08-26, navigation-audit fix batch, item 3) — kept as
// its own local copy rather than a new shared extraction, matching this
// codebase's existing convention (every one of those other files already
// keeps its own local copy too, not a prior inconsistency introduced here).
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
  reaudit_pending: "Re-audit (pre-payment)",
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

// Payment status filter (confirmed 2026-09-07) — deliberately its own
// dimension, separate from the existing Status filter: Status filters on
// the raw lifecycle value (which already includes 'awaiting_payment' as
// one value covering two real sub-cases), while this lets a reviewer
// isolate specifically by payment state across every entity type that has
// one (modules, Execution Sprint, and the new pre-payment re-audit rows)
// — sessions/Core-Audit-reports never have one, correctly excluded from
// the option list and handled via a real "Not applicable" choice, same
// pattern as the existing Severity filter's own "none" option.
/**
 * Filterable payment-status bucket (real fix, found and closed 2026-09-08
 * while sweeping every "Unpaid"/checked-state display for the final
 * status-flow spec — not one of that batch's own named items, but
 * directly required by two rules already confirmed there). The raw
 * `payment_status` column still genuinely distinguishes pending/
 * processing/unpaid at the DB level (that mechanism is unchanged) — but
 * none of that distinction is shown to a reviewer anywhere else anymore
 * (see unified-requests.ts's AWAITING_PAYMENT_LABEL), so filtering by the
 * raw value here would resurface exactly the distinction removed
 * everywhere else. Worse, this dropdown was previously showing
 * "Processing" as a real, selectable option — a direct violation of the
 * separately-confirmed rule that 'processing' (the real concurrency-
 * safety claim lock) must never be surfaced in any UI at all. Both are
 * fixed the same way: bucket pending/processing/unpaid into one
 * "Awaiting Payment" filter option; 'paid' stays its own.
 */
function paymentStatusBucket(raw: string): "awaiting_payment" | "paid" {
  return raw === "paid" ? "paid" : "awaiting_payment";
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting Payment",
  paid: "Paid",
};

export function RequestsFilterClient({ rows }: { rows: UnifiedRequestRow[] }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [companySearch, setCompanySearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const statusOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.status))).sort(), [rows]);
  const paymentStatusOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.paymentStatus).filter((p): p is string => p !== null).map(paymentStatusBucket))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (paymentStatusFilter === "none" && r.paymentStatus !== null) return false;
      if (paymentStatusFilter !== "all" && paymentStatusFilter !== "none" && (r.paymentStatus === null || paymentStatusBucket(r.paymentStatus) !== paymentStatusFilter)) return false;
      if (severityFilter === "none" && r.severity !== null) return false;
      if (severityFilter !== "all" && severityFilter !== "none" && r.severity !== severityFilter) return false;
      if (companySearch.trim() && !r.companyName.toLowerCase().includes(companySearch.trim().toLowerCase())) return false;
      if (dateFrom && (!r.date || r.date.slice(0, 10) < dateFrom)) return false;
      if (dateTo && (!r.date || r.date.slice(0, 10) > dateTo)) return false;
      return true;
    });
  }, [rows, typeFilter, statusFilter, paymentStatusFilter, severityFilter, companySearch, dateFrom, dateTo]);

  return (
    <div>
      <div className="mb-4 grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2 lg:grid-cols-6 dark:border-neutral-800 dark:bg-neutral-900">
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

        <Select label="Payment status" value={paymentStatusFilter} onChange={(e) => setPaymentStatusFilter(e.target.value)}>
          <option value="all">All payment statuses</option>
          {paymentStatusOptions.map((p) => (
            <option key={p} value={p}>
              {PAYMENT_STATUS_LABELS[p] ?? p}
            </option>
          ))}
          <option value="none">Not applicable</option>
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
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card-1 dark:border-neutral-800 dark:bg-neutral-900">
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
                    <Link href={`/company/${r.companyId}`} className="font-medium text-accent hover:underline">
                      {r.companyName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <TypeBadge type={r.badgeType} />
                  </td>
                  <td className="px-3 py-2 text-neutral-600 dark:text-neutral-400">{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2">
                    {/* r.displayStatus is the human-readable, payment-aware label
                        (Submitted / Awaiting payment / Under review / Canceled /
                        etc.) — confirmed 2026-09-07 to replace the old raw
                        humanizeStatus(r.status) rendering, which collapsed the
                        real Submitted-vs-Awaiting-payment distinction into one
                        generic "Awaiting payment" label regardless of whether a
                        reviewer had actually checked payment yet. */}
                    <span className="text-neutral-600 dark:text-neutral-400">{r.displayStatus}</span>
                    {r.cancellationReason && (
                      <p className="mt-0.5 max-w-xs text-xs italic text-neutral-400 dark:text-neutral-500">
                        Reason: {r.cancellationReason}
                      </p>
                    )}
                  </td>
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
                    <Link href={r.link} className="text-xs font-medium text-accent hover:underline">
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
