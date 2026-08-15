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

  // Real bug found in production 2026-08-15: extractTextFromDocument()'s
  // own docblock claims "never throws," and that's true for every failure
  // mode it was tested against (corrupted file, wrong format, scanned
  // image-only PDF) — but the underlying library itself (pdf-parse, later
  // fully replaced with unpdf — see extract-text.ts's own docblock for the
  // full root-cause writeup) could still fail at a level that function's
  // own try/catch didn't fully cover. Without this guard, that exception
  // propagated as a raw, uncaught Server Action failure — the exact "500
  // Internal Server Error" / digest-only production error reported live —
  // with no way for the client to see an honest message. Kept as a
  // permanent defensive layer even after the underlying library was
  // replaced: the same class of "the client should never see a raw crash"
  // discipline already applied to every submit handler this same day.
  try {
    return await extractTextFromDocument(file);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: `Couldn't process this document (${message}). Please try a different file, or type the relevant details directly instead.` };
  }
}
