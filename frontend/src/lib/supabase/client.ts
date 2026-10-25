import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client.
 *
 * The site is a static export (Cloudflare Pages), so there is no Next.js server:
 * the browser talks to Supabase directly with the *publishable* key, and every
 * table is protected by Row Level Security policies in the database.
 * Never use the secret / service_role key in this app.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    "Missing Supabase env vars. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  );
}

export const supabase: SupabaseClient = createClient(url, publishableKey, {
  auth: {
    persistSession: true, // keep users signed in across visits (localStorage)
    autoRefreshToken: true,
    detectSessionInUrl: true, // completes the Google OAuth redirect on page load
    flowType: "pkce", // recommended for browser-only apps
  },
});
