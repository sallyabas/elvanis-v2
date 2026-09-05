import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildDataProtectionEvidencePack } from "@/lib/modules/data-protection-compliance/evidence-pack";

/**
 * Downloadable evidence-pack export, extended from Tender Readiness's own
 * (confirmed 2026-09-05, code-quality audit item 5) — see that route's own
 * docblock for the full authorization-pattern writeup; identical here.
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
    const { data: ownRequest } = await supabase.from("module_requests").select("id").eq("id", requestId).eq("status", "sent").maybeSingle();
    if (!ownRequest) return NextResponse.json({ error: "Not authorized to download this evidence pack." }, { status: 403 });
  }

  try {
    const { filename, markdown } = await buildDataProtectionEvidencePack(requestId);
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
