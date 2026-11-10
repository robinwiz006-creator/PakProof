"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "./supabase/server";
import { historySchema } from "./profile-history";
const path = "/profile-history";
function message(value: string): never {
  redirect(`${path}?message=${encodeURIComponent(value)}`);
}
export async function saveHistory(form: FormData) {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/sign-in?next=%2Fprofile-history");
  const id = String(form.get("id") ?? "");
  if (id && !z.uuid().safeParse(id).success)
    message("Invalid record. Reload and try again.");
  const deleting = form.get("action") === "delete";
  let error;
  let data;
  if (deleting) {
    if (!id) message("Select a record to delete.");
    ({ error, data } = await db
      .from("passport_history")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id)
      .select("id"));
  } else {
    const parsed = historySchema.safeParse({
      ...Object.fromEntries(form),
      ongoing: form.get("ongoing") === "on",
      is_public: form.get("is_public") === "on",
    });
    if (!parsed.success) message(parsed.error.issues[0].message);
    const value = {
      ...parsed.data,
      end_date: parsed.data.end_date || null,
      owner_id: user.id,
    };
    ({ error, data } = id
      ? await db
          .from("passport_history")
          .update(value)
          .eq("id", id)
          .eq("owner_id", user.id)
          .select("id")
      : await db.from("passport_history").insert(value).select("id"));
  }
  if (error || !data?.length)
    message(
      "Could not save this record. Check access and database setup, then retry.",
    );
  const { data: profile } = await db
    .from("profiles")
    .select("slug")
    .eq("id", user.id)
    .maybeSingle();
  revalidatePath(path);
  revalidatePath("/portal/talent/preview");
  if (profile?.slug) revalidatePath(`/talent/${profile.slug}`);
  message(
    deleting
      ? "Record deleted."
      : "Record saved. Public visibility still follows your Passport settings.",
  );
}
