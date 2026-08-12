"use server";

import { createClient } from "@/lib/supabase/server";
import { extractTextFromDocument, type ExtractTextResult } from "./extract-text";

/**
 * Shared document-upload Server Action (confirmed 2026-08-12) — one
 * implementation for all three intake surfaces (AI & Governance,
 * Tender Readiness, Data Protection Compliance) rather than three
 * near-identical copies, same "shared logic, can't drift" discipline
 * already used for deriveRoadmap()/computeJourneyStatus()/
 * EvidenceSubmittedDisclosure. Doesn't write anything to the database —
 * it only extracts text from an uploaded file and returns it to the
 * client for review before the real submission — so no company-ownership
 * check applies, only a basic "is there a real authenticated session"
 * check, matching this codebase's standing defense-in-depth discipline
 * against anonymous use of server compute.
 */
export async function extractDocumentTextAction(formData: FormData): Promise<ExtractTextResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "You must be signed in to upload a document." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "No file was received." };
  }

  return extractTextFromDocument(file);
}
