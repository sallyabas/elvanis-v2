"use server";

import { createClient } from "@/lib/supabase/server";
import { createAwaitingPaymentAiReliabilityRequest } from "@/lib/modules/ai-reliability-audit/persist";
import type { AiReliabilityDraftInput } from "@/lib/modules/ai-reliability-audit/types";

export interface SubmitResult {
  success: boolean;
  requestId?: string;
  error?: string;
}

/**
 * Two real fixes together (confirmed 2026-09-06) — see
 * tender-readiness/actions.ts's own docblock for the full reasoning
 * (company-ownership re-verification, same session+ownership check as
 * submitEvidence(); real Groq analysis deferred until a reviewer marks
 * the request paid, see module-payment-gate.ts).
 */
export async function submitAiReliabilityAudit(input: AiReliabilityDraftInput): Promise<SubmitResult> {
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
    const { requestId } = await createAwaitingPaymentAiReliabilityRequest(input);
    return { success: true, requestId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
