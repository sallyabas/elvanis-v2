import { createAdminClient } from "@/lib/supabase/admin";

/**
 * DB-backed pricing (confirmed 2026-08-06) — same "admin-adjustable, not a
 * constant" principle as app-settings.ts (re-audit cadence). Product/tier
 * prices must be able to change from real pilot learnings without a
 * redeploy or a code change, so they live in the `pricing` table, never
 * as a literal in application code. Every price this app ever displays or
 * reasons about must come from here — see CLAUDE.md for the confirmed
 * audit that found zero hardcoded price literals in app code as of the
 * batch that introduced this table.
 */
export interface PricingItem {
  itemKey: string;
  displayName: string;
  priceAmount: number;
  currency: string;
  isPlaceholder: boolean;
  notes: string | null;
  updatedAt: string;
}

interface PricingRow {
  item_key: string;
  display_name: string;
  price_amount: number;
  currency: string;
  is_placeholder: boolean;
  notes: string | null;
  updated_at: string;
}

function mapRow(row: PricingRow): PricingItem {
  return {
    itemKey: row.item_key,
    displayName: row.display_name,
    priceAmount: row.price_amount,
    currency: row.currency,
    isPlaceholder: row.is_placeholder,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

export async function getPricingItem(itemKey: string): Promise<PricingItem | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("pricing").select("*").eq("item_key", itemKey).maybeSingle();
  if (error) throw new Error(`getPricingItem: ${error.message}`);
  return data ? mapRow(data as PricingRow) : null;
}

export async function listPricing(): Promise<PricingItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("pricing").select("*").order("item_key", { ascending: true });
  if (error) throw new Error(`listPricing: ${error.message}`);
  return (data as PricingRow[]).map(mapRow);
}

export async function updatePricingItem(itemKey: string, priceAmount: number, notes?: string | null): Promise<void> {
  const supabase = createAdminClient();
  const update: { price_amount: number; updated_at: string; notes?: string | null } = {
    price_amount: priceAmount,
    updated_at: new Date().toISOString(),
  };
  if (notes !== undefined) update.notes = notes;
  const { error } = await supabase.from("pricing").update(update).eq("item_key", itemKey);
  if (error) throw new Error(`updatePricingItem: ${error.message}`);
}
