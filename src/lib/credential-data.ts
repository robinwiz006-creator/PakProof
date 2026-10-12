import "server-only";
import { redirect } from "next/navigation";
import { isConfigured, supabase, currentUser } from "./supabase/server";
export async function credentialWorkspace() {
  if (!isConfigured())
    redirect("/sign-in?message=Connect%20Supabase%20to%20use%20credentials");
  const db = await supabase();
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  return { db, user };
}
