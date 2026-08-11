import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseReady, supabaseUrl } from "./config";

/**
 * The server client. Reads and writes the session cookie, so a signed-in
 * visitor is signed in during rendering rather than only after hydration.
 */
export async function createClient() {
  if (!supabaseReady) return null;
  const store = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) {
            store.set(name, value, options);
          }
        } catch {
          // called from a Server Component, where cookies are read-only.
          // Harmless: the middleware refreshes the session on every request.
        }
      },
    },
  });
}

/** Who is signed in, or null. Safe to call before the project exists. */
export async function getUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
