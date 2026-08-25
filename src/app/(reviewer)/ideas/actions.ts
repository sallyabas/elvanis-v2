"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createIdeaBacklogEntry,
  updateIdeaBacklogEntry,
  deleteIdeaBacklogEntry,
  type IdeaSource,
  type IdeaStatus,
} from "@/lib/reviewer/idea-backlog";

// Same independent session+role re-check as every other reviewer Server
// Action in this codebase — the (reviewer) layout gates page rendering,
// not these directly reachable POST endpoints.
async function assertReviewer(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "reviewer") throw new Error("Not authorized as a reviewer.");
}

export async function createIdeaBacklogEntryAction(formData: FormData) {
  await assertReviewer();
  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const source = String(formData.get("source") ?? "own_idea") as IdeaSource;
  await createIdeaBacklogEntry(title, description, source);
  revalidatePath("/ideas");
}

export async function updateIdeaBacklogEntryAction(id: string, formData: FormData) {
  await assertReviewer();
  const title = formData.get("title");
  const description = formData.get("description");
  const source = formData.get("source");
  const status = formData.get("status");
  await updateIdeaBacklogEntry(id, {
    title: title !== null ? String(title) : undefined,
    description: description !== null ? String(description) : undefined,
    source: source !== null ? (String(source) as IdeaSource) : undefined,
    status: status !== null ? (String(status) as IdeaStatus) : undefined,
  });
  revalidatePath("/ideas");
}

export async function deleteIdeaBacklogEntryAction(id: string) {
  await assertReviewer();
  await deleteIdeaBacklogEntry(id);
  revalidatePath("/ideas");
}
