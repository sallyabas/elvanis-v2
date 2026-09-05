"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * "Having trouble? Contact us" (confirmed 2026-09-05, direct founder
 * request) — a real, dedicated capture path separate from the general
 * nav/footer mailto: link (which collects and tracks nothing) and
 * separate from session_requests (no scheduling lifecycle applies to
 * "someone is stuck, please help them"). Client-facing submission is
 * unauthenticated-tolerant on purpose — companyId is optional, since a
 * signed-in client on a real page always has one, but this component
 * could plausibly be reused somewhere without a session in the future;
 * not building that dependency in unnecessarily.
 */
export interface SubmitContactRequestResult {
  success: boolean;
  error?: string;
}

export async function submitContactRequest(
  companyId: string | null,
  name: string,
  email: string,
  message: string,
  serviceContext: string | null,
): Promise<SubmitContactRequestResult> {
  if (!name.trim() || !email.trim()) return { success: false, error: "Name and email are required." };

  const admin = createAdminClient();
  const { data: inserted, error: insertError } = await admin
    .from("contact_requests")
    .insert({
      company_id: companyId,
      name: name.trim(),
      email: email.trim(),
      message: message.trim() || null,
      service_context: serviceContext,
    })
    .select("id")
    .single();
  if (insertError) return { success: false, error: `Couldn't submit: ${insertError.message}` };

  const { data: reviewers } = await admin.from("users").select("id").eq("role", "reviewer");
  if ((reviewers ?? []).length > 0) {
    await admin.from("notifications").insert(
      (reviewers ?? []).map((reviewer) => ({
        recipient_type: "reviewer" as const,
        recipient_id: reviewer.id,
        event_type: "contact_request_submitted",
        channel: "email" as const,
        sent_at: null,
        related_contact_request_id: inserted.id,
      })),
    );
  }

  return { success: true };
}

export interface ContactRequest {
  id: string;
  companyId: string | null;
  companyName: string | null;
  name: string;
  email: string;
  message: string | null;
  serviceContext: string | null;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
}

/** Reviewer-facing — every open request, oldest first (same "don't let one silently age out of view" reasoning as every other reviewer queue list). */
export async function listOpenContactRequests(): Promise<ContactRequest[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contact_requests")
    .select("id, company_id, name, email, message, service_context, status, created_at, resolved_at, companies(name)")
    .eq("status", "open")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listOpenContactRequests: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    companyId: row.company_id as string | null,
    companyName: (row.companies as unknown as { name: string } | null)?.name ?? null,
    name: row.name as string,
    email: row.email as string,
    message: row.message as string | null,
    serviceContext: row.service_context as string | null,
    status: row.status as "open" | "resolved",
    createdAt: row.created_at as string,
    resolvedAt: row.resolved_at as string | null,
  }));
}

export async function resolveContactRequest(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("contact_requests").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`resolveContactRequest: ${error.message}`);
}
