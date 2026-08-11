/*
 * Whether the database exists yet.
 *
 * The keys arrive when someone creates the project, and until then every page
 * still has to render — a site that white-screens because an environment
 * variable is missing is worse than one that says so. Everything auth-shaped
 * checks this first and explains itself rather than throwing.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseReady = Boolean(supabaseUrl && supabaseAnonKey);
