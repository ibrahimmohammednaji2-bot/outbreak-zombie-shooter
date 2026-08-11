"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseReady, supabaseUrl } from "./config";

/** The browser client, or null while there is no project to talk to. */
export function createClient() {
  if (!supabaseReady) return null;
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
