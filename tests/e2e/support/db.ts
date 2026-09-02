import { createClient } from "@supabase/supabase-js";

/**
 * Admin (service-role) Supabase client for E2E test setup/teardown —
 * confirmed 2026-09-02. Only ever imported by test support code (this
 * directory), never by application code — same "one admin client per
 * concern" discipline the app itself follows elsewhere.
 */
export function createTestAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run the E2E suite (same Supabase project the app itself uses).",
    );
  }
  return createClient(url, key);
}
