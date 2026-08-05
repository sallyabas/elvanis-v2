"use server";

import { runAndPersistTenderReadinessAudit } from "@/lib/modules/tender-readiness/persist";
import type { TenderReadinessDraftInput } from "@/lib/modules/tender-readiness/types";

export interface SubmitResult {
  success: boolean;
  requestId?: string;
  error?: string;
}

export async function submitTenderReadinessAudit(input: TenderReadinessDraftInput): Promise<SubmitResult> {
  try {
    const { requestId } = await runAndPersistTenderReadinessAudit(input);
    return { success: true, requestId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
