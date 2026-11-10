import "server-only";
import { authHref } from "./auth-navigation";
import { redirect } from "next/navigation";
import { isConfigured, supabase, currentUser } from "./supabase/server";
export async function credentialWorkspace(returnTo?: string) {
  if (!isConfigured())
    redirect("/sign-in?message=Connect%20Supabase%20to%20use%20credentials");
  const db = await supabase();
  const user = await currentUser();
  if (!user) redirect(authHref("/sign-in", returnTo));
  return { db, user };
}
