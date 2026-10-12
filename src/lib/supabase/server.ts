import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cache } from "react";
import { cookies } from "next/headers";
export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export const supabase = cache(async () => {
  if (!isConfigured())
    throw new Error("Connect Supabase to use accounts and save your work.");
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server Components cannot write cookies; proxy refreshes sessions. */
          }
        },
      },
    },
  );
});

// Request-scoped only: never share authenticated results across users.
export const currentUser = cache(async () => {
  const db = await supabase();
  return (await db.auth.getUser()).data.user;
});
