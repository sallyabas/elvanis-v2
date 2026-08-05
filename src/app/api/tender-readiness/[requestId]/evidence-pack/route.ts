import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildTenderReadinessEvidencePack } from "@/lib/modules/tender-readiness/evidence-pack";

/**
 * Downloadable evidence-pack export (confirmed 2026-08-05, Priority 3) —
 * reviewer-only for now, same "prove it works before expanding" scoping as
 * the export format itself: no client-facing download surface exists yet
 * for any module result (CLAUDE.md already documents Reports & History
 * showing "Detail view coming soon" for modules) — adding one is real,
 * deliberately-deferred follow-on scope, not silently dropped here.
 *
 * Session + role check mirrors every other reviewer-facing Server
 * Action/route in this codebase (independently reachable, not protected by
 * the page-level layout gate alone).
 */
export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "reviewer") return NextResponse.json({ error: "Not authorized as a reviewer." }, { status: 403 });

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
