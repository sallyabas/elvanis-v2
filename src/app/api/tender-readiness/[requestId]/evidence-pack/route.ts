import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildTenderReadinessEvidencePack } from "@/lib/modules/tender-readiness/evidence-pack";

/**
 * Downloadable evidence-pack export (confirmed 2026-08-05, Priority 3) —
 * originally reviewer-only, extended 2026-08-15 (real bug list item #6,
 * the new client-facing module detail page) to also allow the owning
 * client to download their own delivered request's pack. Two independent
 * authorization paths, checked in order: a reviewer can fetch any
 * request; a client can only fetch a request that (a) belongs to their
 * own company and (b) has actually been delivered — both enforced here
 * directly, not left to buildTenderReadinessEvidencePack() itself, since
 * that function has no concept of "who's asking."
 */
export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role !== "reviewer") {
    // Not a reviewer — check whether this is the owning client's own,
    // already-delivered request. RLS on module_requests already restricts
    // a session-scoped select to the caller's own `sent` rows (see
    // 20260806090000_module_requests_rls_fix.sql), so a real match here is
    // itself proof of both ownership and delivery — no separate check
    // needed.
    const { data: ownRequest } = await supabase.from("module_requests").select("id").eq("id", requestId).eq("status", "sent").maybeSingle();
    if (!ownRequest) return NextResponse.json({ error: "Not authorized to download this evidence pack." }, { status: 403 });
  }

  try {
    const { filename, markdown } = await buildTenderReadinessEvidencePack(requestId);
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong." }, { status: 400 });
  }
}
