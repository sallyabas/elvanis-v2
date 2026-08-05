"use server";

import { runAndPersistAiReliabilityAudit } from "@/lib/modules/ai-reliability-audit/persist";
import type { AiReliabilityDraftInput } from "@/lib/modules/ai-reliability-audit/types";

export interface SubmitResult {
  success: boolean;
  requestId?: string;
  error?: string;
}

export async function submitAiReliabilityAudit(input: AiReliabilityDraftInput): Promise<SubmitResult> {
  try {
    const { requestId } = await runAndPersistAiReliabilityAudit(input);
    return { success: true, requestId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
