"use server";

import { runAndPersistDataProtectionComplianceAudit } from "@/lib/modules/data-protection-compliance/persist";
import type { DataProtectionDraftInput } from "@/lib/modules/data-protection-compliance/types";

export interface SubmitResult {
  success: boolean;
  requestId?: string;
  error?: string;
}

export async function submitDataProtectionComplianceAudit(input: DataProtectionDraftInput): Promise<SubmitResult> {
  try {
    const { requestId } = await runAndPersistDataProtectionComplianceAudit(input);
    return { success: true, requestId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
