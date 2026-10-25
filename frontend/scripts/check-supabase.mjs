// Connection check for the Supabase project in .env.local.
// Run: npm run check:supabase
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are not set (.env.local)");
  process.exit(1);
}

let failed = false;
const ok = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  failed = true;
  console.error(`✗ ${msg}`);
};

// 1. Auth service is up and accepts the publishable key
const health = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } }).catch((e) => e);
if (health instanceof Error) fail(`Could not reach ${url}: ${health.message}`);
else if (!health.ok) fail(`Auth health check returned HTTP ${health.status}`);
else ok(`Auth service reachable (${(await health.json()).name ?? "GoTrue"})`);

const supabase = createClient(url, key, { auth: { persistSession: false } });

// 2. Auth client works (no user yet is expected)
const { data: session, error: sessionError } = await supabase.auth.getSession();
if (sessionError) fail(`auth.getSession(): ${sessionError.message}`);
else ok(`Auth client OK (session: ${session.session ? "signed in" : "none, as expected"})`);

// 3. Schema from supabase/migrations is applied (checked as an anonymous visitor)
const missing = (e) => e && (e.code === "PGRST205" || e.code === "PGRST202" || e.code === "42P01" || e.code === "42883");

// (not a HEAD request: those drop the error body, so a missing table would look "fine")
const listings = await supabase.from("listings").select("id", { count: "exact" }).limit(1);
if (missing(listings.error)) {
  fail("Table `listings` not found. Run supabase/migrations/*_initial_schema.sql in the SQL Editor.");
} else if (listings.error) {
  fail(`listings: ${listings.error.code} ${listings.error.message}`);
} else {
  ok(`Table listings readable by visitors (${listings.count ?? 0} rows)`);

  const search = await supabase.rpc("search_listings", { p_lat: 6.9271, p_lng: 79.8612, p_radius_km: 25, p_limit: 5 });
  if (search.error) fail(`search_listings(): ${search.error.code} ${search.error.message}`);
  else ok(`PostGIS near-me search works (${search.data.length} listings within 25 km of Colombo)`);

  // Row Level Security / grants: visitors must NOT be able to read profiles or claims
  for (const table of ["profiles", "claims", "reports"]) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (error?.code === "42501" || (!error && data.length === 0)) ok(`${table}: hidden from anonymous visitors`);
    else if (missing(error)) fail(`Table \`${table}\` not found`);
    else fail(`${table} is readable by anonymous visitors: check its RLS policies`);
  }

  // A public bucket answers "object not found" for a made-up file; a missing bucket says "bucket not found"
  const probe = await fetch(`${url}/storage/v1/object/public/listing-photos/__connection_check__.jpg`).then((r) => r.json()).catch(() => ({}));
  if (probe.code === "NoSuchKey") ok("Storage bucket listing-photos is public");
  else fail(`Storage bucket listing-photos: ${probe.code ?? "no response"}`);

  const claim = await supabase.rpc("request_claim", { p_listing_id: "00000000-0000-0000-0000-000000000000" });
  if (claim.error?.code === "42501") ok("Claim functions require sign-in");
  else fail(`request_claim() should reject visitors, got: ${claim.error?.code ?? "success"}`);
}

process.exit(failed ? 1 : 0);
