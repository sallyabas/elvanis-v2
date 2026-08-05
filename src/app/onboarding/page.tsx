import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./OnboardingWizard";

// Real Company/Goal creation (confirmed 2026-08-03, Priority 1) — a
// top-level route deliberately outside the (app) route group, so
// (app)/layout.tsx can redirect here unconditionally when a signed-in
// client has no company yet, without risking a redirect loop (this page
// isn't wrapped by that layout, so it's never itself subject to the
// redirect it's the target of).
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: existingCompany } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
  if (existingCompany) {
    redirect("/business-profile");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <OnboardingWizard />
    </div>
  );
}
