"use server";

import { createClient } from "@/lib/supabase/server";
import { createAwaitingPaymentTenderReadinessRequest } from "@/lib/modules/tender-readiness/persist";
import type { TenderReadinessDraftInput } from "@/lib/modules/tender-readiness/types";

export interface SubmitResult {
  success: boolean;
  requestId?: string;
  error?: string;
}

/**
 * Two real fixes together (confirmed 2026-09-06):
 *
 * 1. Company-ownership re-verification — a real, confirmed gap found
 *    alongside the payment gate investigation: this Server Action trusted
 *    `input.companyId` from the client with zero check that it actually
 *    belongs to the calling session, even though the page that renders
 *    this form derives `companyId` correctly server-side (a tampered
 *    client-side value could still submit a request against ANY
 *    company's id, since Server Actions are directly-reachable POST
 *    endpoints independent of the page that rendered their UI — same
 *    class of gap already found and fixed for the standalone module
 *    ENTRY PAGES on 2026-08-15, but never closed at the Server Action
 *    layer itself). Same session+ownership check as submitEvidence().
 * 2. No real Groq analysis runs here anymore — see
 *    createAwaitingPaymentTenderReadinessRequest()'s own docblock. The
 *    real analysis only runs once a reviewer marks the request paid (see
 *    module-payment-gate.ts).
 */
export async function submitTenderReadinessAudit(input: TenderReadinessDraftInput): Promise<SubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in." };

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("id", input.companyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (companyError || !company) return { success: false, error: "Company not found." };

  try {
    const { requestId } = await createAwaitingPaymentTenderReadinessRequest(input);
    return { success: true, requestId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
