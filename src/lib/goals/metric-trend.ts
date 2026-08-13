import type { SupabaseClient } from "@supabase/supabase-js";
import { findMetricDefinition, type MetricDirection } from "@/lib/lenses/metric-direction";

/**
 * Goal metric trend-tracking (confirmed 2026-08-13, item 2 of the
 * old-Elvanis-inspired batch) — the smaller, honest scope confirmed over
 * the heavier "achieved/missed" version: shows the client's own tracked
 * metric's real numeric progression across their real delivered audits
 * (e.g. "gross margin: 58% → 62%"), never a fabricated achieved/missed
 * verdict against their stated target — that needs real repeat-audit
 * volume to be worth building and stays deliberately deferred (see
 * CLAUDE.md).
 *
 * Reads real numbers straight from `reports.source_evidence_snapshot`
 * (the exact evidence payload each audit ran against, already stored
 * verbatim since the basic re-run/refresh button work) — never derived
 * from a finding's prose, never LLM-summarized. `status = 'sent'` only,
 * same policy the client-facing report view itself relies on, so this can
 * safely use the session-scoped client (no admin-client workaround
 * needed, unlike computeJourneyStatus()'s own pending/in-review states).
 */
export interface MetricTrendPoint {
  reportId: string;
  value: number;
  reportDate: string;
}

export interface MetricTrend {
  metricKey: string;
  label: string;
  unit: string;
  direction: MetricDirection;
  targetValue: number | null;
  /** Chronological, oldest first. */
  points: MetricTrendPoint[];
}

interface SnapshotLensSlice {
  metrics?: { metricKey: string; value: number }[];
}

interface EvidenceSnapshot {
  financial?: SnapshotLensSlice;
  execution?: SnapshotLensSlice;
  product?: SnapshotLensSlice;
}

/**
 * Returns null when the company has no target metric set, OR when zero
 * real reports contain that metric — both honest "nothing to show yet"
 * states, not errors. A single data point is still returned (current
 * value only, no real trend) rather than requiring two — the caller
 * decides how to render that case.
 */
export async function loadGoalMetricTrend(
  supabase: SupabaseClient,
  companyId: string,
  goal: { targetMetricKey: string | null; targetMetricValue: number | null },
): Promise<MetricTrend | null> {
  if (!goal.targetMetricKey) return null;
  const definition = findMetricDefinition(goal.targetMetricKey);
  if (!definition) return null;

  const { data: reports } = await supabase
    .from("reports")
    .select("id, delivered_at, source_evidence_snapshot")
    .eq("company_id", companyId)
    .eq("status", "sent")
    .not("source_evidence_snapshot", "is", null)
    .order("delivered_at", { ascending: true });

  const points: MetricTrendPoint[] = [];
  for (const report of reports ?? []) {
    const snapshot = report.source_evidence_snapshot as EvidenceSnapshot | null;
    const metrics = snapshot?.[definition.lens]?.metrics ?? [];
    const match = metrics.find((m) => m.metricKey === goal.targetMetricKey);
    if (match && typeof match.value === "number") {
      points.push({ reportId: report.id as string, value: match.value, reportDate: report.delivered_at as string });
    }
  }

  if (points.length === 0) return null;

  return {
    metricKey: definition.metricKey,
    label: definition.label,
    unit: definition.unit,
    direction: definition.direction,
    targetValue: goal.targetMetricValue,
    points,
  };
}
